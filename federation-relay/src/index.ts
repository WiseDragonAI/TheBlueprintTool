/**
 * WHAT: Authenticates federation nodes and coordinates catalog, state, and content-stream relay work.
 * WHY: One Durable Object must serialize durable project-state joins and route bounded live traffic.
 */
import { DurableObject } from 'cloudflare:workers';
import {
  chunkBytes,
  creditWindowBytes,
  encodedByteLength,
  assertStateManifest,
  maximumStateFrameBytes,
  maximumStreamsPerNode,
  parseFrame,
  priorityStateFrameTypes,
  protocolVersion,
  stateBaselineEpoch,
  stateProtocol,
  stateSchema,
  type ProjectManifest,
  type RelayFrame,
} from './protocol';
import { joinRelayEntity, type RelayEntity } from './current-state';
import { stateEntityFrames } from './state-entity-frames';
import {
  assertFederationRepairManifest,
  canonicalFederationRepairBuckets,
  claimFederationRepairBuckets,
  createFederationRepairRecord,
  currentFederationRepairRecord,
  federationRepairRecordKey,
  type FederationRepairRecord,
} from '../../shared/federation-repair-guard';
import {
  hashTaskCurrentRoot,
  taskEntityDotCollisions,
  taskCurrentEntityKey,
  taskCurrentStateVersion,
} from '../../shared/task-current-state-core';
import {
  federationStateRejectionCode,
  type FederationStateRejection,
} from '../../shared/federation-state-transport';
import {
  admitStateEntries,
  mismatchedBuckets,
  stateBucketKey,
  stateBucketPrefix,
  stateEntityBatchSize,
  stateEntityPrefix,
  summarizeBucket,
  type StateBucket,
  type StateEntry,
} from './state-storage';

type Env = {
  FEDERATIONS: DurableObjectNamespace<FederationRelay>;
  ADMIN_SECRET: string;
  DECISION_OS_RELEASE_SHA: string;
  FEDERATIONS_NAMESPACE: string;
  RELAY_ENVIRONMENT: 'production' | 'dev';
  RELAY_WORKER_NAME: string;
};

type SocketIdentity = { nodeId: string; sessionId: string };
type Stream = { requester: string; owner: string; requestCredit: number; responseCredit: number };
type RelayRoute =
  | { kind: 'connect'; federationId: string; nodeId: string }
  | { kind: 'provision-node'; federationId: string; nodeId: string }
  | { kind: 'reset-project-state'; federationId: string; projectId: string }
  | { kind: 'delete-canary-state'; federationId: string };
async function listAll<T>(storage: DurableObjectStorage, prefix: string): Promise<Map<string, T>> {
  const result = new Map<string, T>();
  let startAfter: string | undefined;
  while (true) {
    const page = await storage.list<T>({ prefix, startAfter, limit: 1_000 });
    for (const [key, value] of page) result.set(key, value);
    if (page.size < 1_000) return result;
    startAfter = [...page.keys()].at(-1);
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

async function sameSecret(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let different = aa.length ^ bb.length;
  for (let index = 0; index < aa.length; index += 1) different |= aa[index] ^ bb[index];
  return different === 0;
}

function routeParts(url: URL): RelayRoute | null {
  const connect = url.pathname.match(/^\/connect\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
  if (connect) return { kind: 'connect', federationId: connect[1], nodeId: connect[2] };
  const admin = url.pathname.match(/^\/admin\/federations\/([a-zA-Z0-9_-]+)\/nodes\/([a-zA-Z0-9_-]+)$/);
  if (admin) return { kind: 'provision-node', federationId: admin[1], nodeId: admin[2] };
  const reset = url.pathname.match(/^\/admin\/federations\/([a-zA-Z0-9_-]+)\/projects\/([a-zA-Z0-9_-]+)\/reset-state$/);
  if (reset) return { kind: 'reset-project-state', federationId: reset[1], projectId: reset[2] };
  const deleteCanary = url.pathname.match(/^\/admin\/federations\/([a-zA-Z0-9_-]+)\/canary-state$/);
  return deleteCanary ? { kind: 'delete-canary-state', federationId: deleteCanary[1] } : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({
        ok: true,
        status: 'ready',
        service: 'decision-os-federation-relay',
        observedAt: new Date().toISOString(),
        releaseSha: env.DECISION_OS_RELEASE_SHA,
        deliveryProtocol: 1,
        protocolVersion,
        stateProtocol,
        stateSchema,
        baselineEpoch: stateBaselineEpoch,
        environment: env.RELAY_ENVIRONMENT,
        workerName: env.RELAY_WORKER_NAME,
        durableObjectNamespace: env.FEDERATIONS_NAMESPACE,
      });
    }
    const route = routeParts(url);
    if (!route) return json({ ok: false, error: 'not_found' }, 404);
    const stub = env.FEDERATIONS.getByName(route.federationId, { locationHint: 'apac' });

    if (route.kind !== 'connect') {
      if (!env.ADMIN_SECRET) return json({ ok: false, error: 'relay_not_configured' }, 503);
      const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (!(await sameSecret(supplied, env.ADMIN_SECRET))) return json({ ok: false, error: 'federation_authentication' }, 401);
      // WHAT: Reject canary teardown for every federation outside the fixed harness-owned namespace.
      // WHY: The administration surface must never expose arbitrary production federation deletion.
      if (route.kind === 'delete-canary-state' && !/^release_canary_[a-f0-9]{24}$/.test(route.federationId)) return json({ ok: false, error: 'not_found' }, 404);
      const expectedMethod = route.kind === 'delete-canary-state' ? 'DELETE' : 'POST';
      // WHAT: Admit only the one method owned by the selected administration operation.
      // WHY: Method ambiguity must not widen destructive authority.
      if (request.method !== expectedMethod) return json({ ok: false, error: 'method_not_allowed' }, 405);
      const path = route.kind === 'reset-project-state'
        ? `/admin/projects/${route.projectId}/reset-state`
        : route.kind === 'delete-canary-state'
          ? '/admin/canary-state'
          : `/admin/nodes/${route.nodeId}`;
      const response = await stub.fetch(new Request(`https://relay.internal${path}`, request));
      // WHAT: Correlate successful destructive evidence to the exact outer-selected canary federation.
      // WHY: The named Durable Object does not otherwise know the binding name used to address it.
      if (route.kind === 'delete-canary-state' && response.status === 200) {
        return json({ ...(await response.json() as Record<string, unknown>), federationId: route.federationId });
      }
      return response;
    }

    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return json({ ok: false, error: 'websocket_required' }, 426);
    }
    return stub.fetch(new Request(`https://relay.internal/connect/${route.nodeId}`, request));
  },
} satisfies ExportedHandler<Env>;

export class FederationRelayV4 extends DurableObject<Env> {
  private readonly streams = new Map<string, Stream>();
  private readonly subscriptions = new Map<string, Set<string>>();
  private manifests = new Map<string, ProjectManifest[]>();
  private nodeLabels = new Map<string, string>();

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    state.blockConcurrencyWhile(async () => {
      this.manifests = new Map((await state.storage.get<Array<[string, ProjectManifest[]]>>('manifests')) ?? []);
      this.nodeLabels = new Map((await state.storage.get<Array<[string, string]>>('nodeLabels')) ?? []);
    });
  }

  private activeSockets(): WebSocket[] {
    return this.ctx.getWebSockets().filter((socket) => socket.readyState === WebSocket.OPEN);
  }

  private socket(nodeId: string): WebSocket | undefined {
    return this.activeSockets().find((candidate) => (candidate.deserializeAttachment() as SocketIdentity | null)?.nodeId === nodeId);
  }

  private hasProject(nodeId: string, projectId: string): boolean {
    return (this.manifests.get(nodeId) ?? []).some((project) => project.id === projectId);
  }

  private participatesInProject(nodeId: string, projectId: string): boolean {
    return this.hasProject(nodeId, projectId) || (this.subscriptions.get(nodeId)?.has(projectId) ?? false);
  }

  private assertProjectParticipation(nodeId: string, projectId: string): void {
    if (!projectId || !this.participatesInProject(nodeId, projectId)) throw new Error('unknown_state_project');
  }

  private sendSocket(socket: WebSocket, frame: RelayFrame): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(frame));
    } catch {
      // A peer can enter CLOSING between the readyState check and send.
    }
  }

  private send(nodeId: string, frame: RelayFrame): void {
    const socket = this.socket(nodeId);
    if (socket) this.sendSocket(socket, frame);
  }

  private async stateBuckets(projectId: string): Promise<StateBucket[]> {
    const entries = await listAll<StateBucket>(this.ctx.storage, stateBucketPrefix(projectId));
    return [...entries.values()].sort((left, right) => left.bucket.localeCompare(right.bucket)).map(({ entries: _entries, ...summary }) => summary);
  }

  private stateGenerationKey(projectId: string): string {
    return `state:v4:generation:${encodeURIComponent(projectId)}`;
  }

  private stateBroadcastGenerationKey(projectId: string): string {
    return `state:v4:broadcast-generation:${encodeURIComponent(projectId)}`;
  }

  private async deleteStatePrefix(prefix: string): Promise<number> {
    let deleted = 0;
    while (true) {
      const page = await this.ctx.storage.list({ prefix, limit: 128 });
      const keys = [...page.keys()];
      if (keys.length === 0) return deleted;
      await this.ctx.storage.delete(keys);
      deleted += keys.length;
    }
  }

  private async resetProjectState(projectId: string): Promise<Response> {
    const connected = [...new Set(this.activeSockets().flatMap((socket) => {
      const nodeId = (socket.deserializeAttachment() as SocketIdentity | null)?.nodeId ?? '';
      return nodeId && this.participatesInProject(nodeId, projectId) ? [nodeId] : [];
    }))].sort();
    // WHAT: Reject reset while any participating node can publish state.
    // WHY: Deletion and concurrent replication must not race into a partial epoch reset.
    if (connected.length > 0) {
      return json({ ok: false, error: 'project_nodes_online', nodes: connected }, 409);
    }
    const entitiesDeleted = await this.deleteStatePrefix(stateEntityPrefix(projectId));
    const bucketsDeleted = await this.deleteStatePrefix(stateBucketPrefix(projectId));
    await this.deleteStatePrefix(`state:v4:repair:${encodeURIComponent(projectId)}:`);
    await this.ctx.storage.delete([this.stateGenerationKey(projectId), this.stateBroadcastGenerationKey(projectId)]);
    const resetAt = new Date().toISOString();
    await this.ctx.storage.put(`state:v4:reset:${encodeURIComponent(projectId)}:${resetAt}`, { projectId, resetAt, entitiesDeleted, bucketsDeleted });
    return json({ ok: true, projectId, entitiesDeleted, bucketsDeleted, root: hashTaskCurrentRoot([]), resetAt });
  }

  private async deleteCanaryState(): Promise<Response> {
    const connected = this.activeSockets().flatMap((socket) => {
      const nodeId = (socket.deserializeAttachment() as SocketIdentity | null)?.nodeId ?? '';
      return nodeId ? [nodeId] : [];
    }).sort();
    // WHAT: Reject teardown while any node in this federation can publish state.
    // WHY: Canary deletion must not race a live socket into recreated partial authority.
    if (connected.length > 0) return json({ ok: false, error: 'federation_nodes_online', nodes: connected }, 409);
    await this.ctx.storage.deleteAll();
    this.streams.clear();
    this.subscriptions.clear();
    this.manifests.clear();
    this.nodeLabels.clear();
    return json({ ok: true, deleted: true });
  }

  private async sendStateSummary(socket: WebSocket, projectId: string): Promise<void> {
    const buckets = await this.stateBuckets(projectId);
    this.sendSocket(socket, { version: 1, type: 'state-bucket-summary', from: 'relay', projectId, stateVersion: taskCurrentStateVersion, payload: { stateVersion: taskCurrentStateVersion, root: hashTaskCurrentRoot(buckets), buckets } });
  }

  private sendStateEntities(socket: WebSocket, projectId: string, entities: RelayEntity[]): void {
    for (const frame of stateEntityFrames(projectId, entities)) this.sendSocket(socket, frame);
  }

  private async persistStateEntities(sender: string, socket: WebSocket, frame: RelayFrame): Promise<void> {
    const projectId = String(frame.projectId ?? '');
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    const deliveryId = String(payload.deliveryId ?? '');
    const wireEntries = Array.isArray(payload.entries) ? payload.entries as StateEntry[] : [];
    this.assertProjectParticipation(sender, projectId);
    if (!deliveryId || wireEntries.length === 0 || wireEntries.length > stateEntityBatchSize) throw new Error('invalid_state_entity_batch');
    const entries = admitStateEntries(projectId, wireEntries);
    const changed: RelayEntity[] = [];
    const accepted: Array<{ key: string; stateHash: string }> = [];
    const rejected: FederationStateRejection[] = [];
    await this.ctx.storage.transaction(async (transaction) => {
      const existing = await transaction.get<RelayEntity>(entries.map((entry) => entry.key));
      const joined = entries.flatMap((entry) => {
        try {
          return [{ ...entry, value: joinRelayEntity(existing.get(entry.key), entry.entity) }];
        } catch (error) {
          const code = federationStateRejectionCode(error);
          // WHAT: Preserve the existing relay entity and correlate one terminal same-dot rejection to its delivery.
          // WHY: Retrying an irreconcilable causal collision cannot change its outcome and previously caused reconnect floods.
          if (code) {
            const relayEntity = existing.get(entry.key);
            // WHAT: Attach the exact relay hash and collision paths/dots to the correlated rejection.
            // WHY: Non-destructive recovery must construct a causal successor without weakening join admission.
            if (!relayEntity) throw error;
            rejected.push({ key: entry.entityKey, stateHash: entry.entity.stateHash, relayStateHash: relayEntity.stateHash, collisions: taskEntityDotCollisions(relayEntity, entry.entity), code });
            return [];
          }
          throw error;
        }
      });
      accepted.push(...joined.map((entry) => ({ key: entry.entityKey, stateHash: entry.value.stateHash })));
      const additions = joined.filter((entry) => existing.get(entry.key)?.stateHash !== entry.value.stateHash);
      // WHAT: Leave the relay root generation unchanged when every accepted entity is already durable.
      // WHY: Duplicate deliveries must not create a fresh repair budget.
      const generationKey = this.stateGenerationKey(projectId);
      const generation = await transaction.get<number>(generationKey) ?? 0;
      let resultingGeneration = generation;
      // WHAT: Persist only entries that joined without a terminal causal collision.
      // WHY: One rejected entity must not discard unrelated valid entries from the same bounded transaction.
      if (additions.length > 0) {
        changed.push(...additions.map((entry) => entry.value));
        const bucketNames = [...new Set(additions.map((entry) => entry.bucket))];
        const existingBuckets = await transaction.get<StateBucket>(bucketNames.map((bucket) => stateBucketKey(projectId, bucket)));
        await transaction.put(Object.fromEntries(additions.map((entry) => [entry.key, entry.value])));
        await transaction.put(Object.fromEntries(bucketNames.map((bucket) => {
          const current = existingBuckets.get(stateBucketKey(projectId, bucket));
          const bucketEntries = { ...(current?.entries ?? {}) };
          for (const entry of additions.filter((candidate) => candidate.bucket === bucket)) {
            bucketEntries[entry.entityKey] = entry.value.stateHash;
          }
          const value = summarizeBucket(bucket, bucketEntries);
          return [stateBucketKey(projectId, bucket), value];
        })));
        resultingGeneration += 1;
        await transaction.put(generationKey, resultingGeneration);
      }
      // WHAT: Retain the exact terminal rejection under the existing project-and-node repair key.
      // WHY: Reconnect must not erase the evidence that automatic delivery cannot converge this causal dot.
      if (rejected.length > 0) {
        const repairKey = federationRepairRecordKey(sender, projectId);
        const retained = await transaction.get<FederationRepairRecord>(repairKey);
        const record = currentFederationRepairRecord(retained, resultingGeneration)
          ? retained
          : createFederationRepairRecord({ nodeId: sender, projectId, generation: resultingGeneration });
        await transaction.put(repairKey, { ...record, rejected });
      }
    });
    this.sendSocket(socket, { version: 1, type: 'state-relay-ack', from: 'relay', projectId, stateVersion: taskCurrentStateVersion, payload: { stateVersion: taskCurrentStateVersion, deliveryId, accepted, rejected } });
    for (const target of this.activeSockets()) {
      const targetNodeId = (target.deserializeAttachment() as SocketIdentity | null)?.nodeId ?? '';
      if (target !== socket && changed.length > 0 && this.participatesInProject(targetNodeId, projectId)) this.sendStateEntities(target, projectId, changed);
    }
  }

  private async reconcileStateSummary(sender: string, socket: WebSocket, frame: RelayFrame): Promise<void> {
    const projectId = String(frame.projectId ?? '');
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    const remote = Array.isArray(payload.buckets) ? payload.buckets as StateBucket[] : [];
    this.assertProjectParticipation(sender, projectId);
    const peerRoot = String(payload.root ?? '');
    const peerManifestDigest = assertFederationRepairManifest(peerRoot, remote);
    const generation = await this.ctx.storage.get<number>(this.stateGenerationKey(projectId)) ?? 0;
    const repairKey = federationRepairRecordKey(sender, projectId);
    const admitted = await this.ctx.storage.transaction(async (transaction) => {
      const existing = await transaction.get<FederationRepairRecord>(repairKey);
      // WHAT: Reuse one exact node, project, generation, peer-root, and manifest repair identity across socket replacement.
      // WHY: Reconnecting with unchanged durable state must not purchase another scan or observer fan-out.
      if (currentFederationRepairRecord(existing, generation, peerRoot, peerManifestDigest)) return false;
      await transaction.put(repairKey, createFederationRepairRecord({ nodeId: sender, projectId, generation, peerRoot, peerManifestDigest }));
      return true;
    });
    // WHAT: End duplicate summary handling before the first bucket storage read.
    // WHY: Durable admission is the relay's final flood-containment boundary.
    if (!admitted) return;
    let local: StateBucket[];
    try {
      local = await this.stateBuckets(projectId);
    } catch (error) {
      await this.ctx.storage.delete(repairKey);
      throw error;
    }
    const missingFromRelay = mismatchedBuckets(local, remote);
    // WHAT: Ask once for buckets absent from the admitted relay-root generation.
    // WHY: A first valid peer summary must retain normal reverse convergence.
    if (missingFromRelay.length > 0) {
      this.sendSocket(socket, { version: 1, type: 'state-missing-request', from: 'relay', projectId, stateVersion: taskCurrentStateVersion, payload: { stateVersion: taskCurrentStateVersion, buckets: missingFromRelay } });
    }
    const localRoot = hashTaskCurrentRoot(local);
    const summary: RelayFrame = { version: 1, type: 'state-bucket-summary', from: 'relay', projectId, stateVersion: taskCurrentStateVersion, payload: { stateVersion: taskCurrentStateVersion, root: localRoot, buckets: local } };
    const broadcastGeneration = await this.ctx.storage.get<number>(this.stateBroadcastGenerationKey(projectId)) ?? 0;
    // WHAT: Broadcast one terminal summary only after durable state advanced to an unannounced generation.
    // WHY: Healthy participants need the changed root once, while unchanged peer summaries must not fan out.
    if (generation > 0 && broadcastGeneration < generation) {
      for (const target of this.activeSockets()) {
        const targetNodeId = (target.deserializeAttachment() as SocketIdentity | null)?.nodeId ?? '';
        // WHAT: Deliver the changed root only to authenticated project participants.
        // WHY: Unrelated nodes must remain outside this repair generation.
        if (this.participatesInProject(targetNodeId, projectId)) this.sendSocket(target, summary);
      }
      await this.ctx.storage.put(this.stateBroadcastGenerationKey(projectId), generation);
    } else {
      this.sendSocket(socket, summary);
    }
    // WHAT: Confirm exact equality after the admitted summary has been answered.
    // WHY: Existing epoch-4 nodes use this frame to settle relay-bound publication.
    if (missingFromRelay.length === 0 && payload.root === localRoot) {
      this.sendSocket(socket, { version: 1, type: 'state-converged', from: 'relay', projectId, stateVersion: taskCurrentStateVersion, payload: { stateVersion: taskCurrentStateVersion, nodeId: sender, root: localRoot } });
    }
  }

  private async sendMissingStateEntities(sender: string, socket: WebSocket, frame: RelayFrame): Promise<void> {
    const projectId = String(frame.projectId ?? '');
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    this.assertProjectParticipation(sender, projectId);
    const buckets = canonicalFederationRepairBuckets(Array.isArray(payload.buckets) ? payload.buckets : []);
    const generation = await this.ctx.storage.get<number>(this.stateGenerationKey(projectId)) ?? 0;
    const repairKey = federationRepairRecordKey(sender, projectId);
    const admitted = await this.ctx.storage.transaction(async (transaction) => {
      const retained = await transaction.get<FederationRepairRecord>(repairKey);
      const existing = currentFederationRepairRecord(retained, generation)
        ? retained
        : createFederationRepairRecord({ nodeId: sender, projectId, generation });
      return claimFederationRepairBuckets(existing, buckets).admitted;
    });
    // WHAT: Suppress a request whose buckets were already served for this durable node, project, and relay generation.
    // WHY: Socket replacement must not purchase another read of an unchanged canonical bucket.
    if (admitted.length === 0) return;
    const entities: RelayEntity[] = [];
    for (const bucket of admitted) {
      const page = await listAll<RelayEntity>(this.ctx.storage, stateEntityPrefix(projectId, bucket));
      entities.push(...page.values());
    }
    this.sendStateEntities(socket, projectId, entities);
    await this.sendStateSummary(socket, projectId);
    await this.ctx.storage.transaction(async (transaction) => {
      const retained = await transaction.get<FederationRepairRecord>(repairKey);
      const existing = currentFederationRepairRecord(retained, generation)
        ? retained
        : createFederationRepairRecord({ nodeId: sender, projectId, generation });
      // WHAT: Claim only buckets whose entity response and terminal summary completed.
      // WHY: A failed read, encoding, send, or summary must remain retryable after reconnect.
      await transaction.put(repairKey, claimFederationRepairBuckets(existing, admitted).record);
    });
  }

  private async publishCatalog(): Promise<void> {
    const sockets = this.activeSockets();
    const online = new Set(sockets.flatMap((socket) => {
      const identity = socket.deserializeAttachment() as SocketIdentity | null;
      return identity?.nodeId ? [identity.nodeId] : [];
    }));
    const nodes = [...this.manifests].map(([nodeId, projects]) => ({ nodeId, nodeLabel: this.nodeLabels.get(nodeId) || nodeId, projects, online: online.has(nodeId) }));
    const frame: RelayFrame = { version: 1, type: 'catalog', nodes };
    for (const socket of sockets) this.sendSocket(socket, frame);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // WHAT: Delete all durable authority only inside an outer-admitted canary federation object.
    // WHY: The Worker boundary already fixed and authenticated the exact harness-owned federation ID.
    if (url.pathname === '/admin/canary-state' && request.method === 'DELETE') return this.deleteCanaryState();
    const reset = url.pathname.match(/^\/admin\/projects\/([a-zA-Z0-9_-]+)\/reset-state$/);
    if (reset && request.method === 'POST') {
      return this.resetProjectState(reset[1]);
    }
    const admin = url.pathname.match(/^\/admin\/nodes\/([a-zA-Z0-9_-]+)$/);
    if (admin && request.method === 'POST') {
      const credential = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credential));
      await this.ctx.storage.put(`credential:${admin[1]}`, Array.from(new Uint8Array(digest)));
      return json({ ok: true, nodeId: admin[1], credential }, 201);
    }

    const connect = url.pathname.match(/^\/connect\/([a-zA-Z0-9_-]+)$/);
    if (!connect) return json({ ok: false, error: 'not_found' }, 404);
    const credential = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const expected = await this.ctx.storage.get<number[]>(`credential:${connect[1]}`);
    const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credential))));
    if (!expected || expected.length !== actual.length || expected.some((value, index) => value !== actual[index])) {
      return json({ ok: false, error: 'federation_authentication' }, 401);
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const previous = this.socket(connect[1]);
    previous?.close(4001, 'replaced');
    server.serializeAttachment({ nodeId: connect[1], sessionId: crypto.randomUUID() } satisfies SocketIdentity);
    this.ctx.acceptWebSocket(server);
    await this.publishCatalog();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const sender = (socket.deserializeAttachment() as SocketIdentity).nodeId;
    let frame: RelayFrame | undefined;
    try {
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
      const frameBytes = new TextEncoder().encode(text).byteLength;
      if (frameBytes > creditWindowBytes) throw new Error('federation_body_limit');
      frame = parseFrame(text);
      if (frame.type === 'manifest') {
        assertStateManifest(frame);
        this.manifests.set(sender, Array.isArray(frame.projects) ? frame.projects : []);
        this.nodeLabels.set(sender, String(frame.nodeLabel || sender).slice(0, 120));
        await this.ctx.storage.put({ manifests: [...this.manifests], nodeLabels: [...this.nodeLabels] });
        await this.publishCatalog();
        for (const project of frame.projects ?? []) {
          const projectId = String(project.id ?? '');
          await this.sendStateSummary(socket, projectId);
        }
        return;
      }
      if (frame.type === 'state-subscribe') {
        if (frame.stateVersion !== taskCurrentStateVersion) throw new Error('incompatible_state_protocol');
        const projectId = String(frame.projectId ?? '');
        if (!projectId) throw new Error('unknown_state_project');
        const subscriptions = this.subscriptions.get(sender) ?? new Set<string>();
        subscriptions.add(projectId);
        this.subscriptions.set(sender, subscriptions);
        await this.sendStateSummary(socket, projectId);
        return;
      }
      if (frame.type === 'content-change') {
        for (const target of this.activeSockets()) {
          if (target !== socket) this.sendSocket(target, { version: 1, type: 'content-change', from: sender });
        }
        return;
      }
      if (priorityStateFrameTypes.has(frame.type)) {
        if (frameBytes > maximumStateFrameBytes) throw new Error('state_frame_too_large');
        if (frame.stateVersion !== taskCurrentStateVersion) throw new Error('incompatible_state_protocol');
        if (!frame.to) {
          if (frame.type === 'state-entity-batch') await this.persistStateEntities(sender, socket, frame);
          else if (frame.type === 'state-execution-observation') {
            const projectId = String(frame.projectId ?? '');
            this.assertProjectParticipation(sender, projectId);
            for (const target of this.activeSockets()) {
              const targetNodeId = (target.deserializeAttachment() as SocketIdentity | null)?.nodeId ?? '';
              if (target !== socket && this.participatesInProject(targetNodeId, projectId)) {
                this.sendSocket(target, { ...frame, from: sender, to: undefined, stateVersion: taskCurrentStateVersion });
              }
            }
          }
          else if (frame.type === 'state-bucket-summary') await this.reconcileStateSummary(sender, socket, frame);
          else if (frame.type === 'state-missing-request') await this.sendMissingStateEntities(sender, socket, frame);
          else if (frame.type === 'state-summary-request') throw new Error('state_summary_request_requires_target');
          else if (frame.type === 'state-ack' || frame.type === 'state-relay-ack' || frame.type === 'state-converged') return;
          else throw new Error('unsupported_relay_state_frame');
          return;
        }
        if (!frame.to || !this.socket(frame.to)) throw new Error('owner_offline');
        this.send(frame.to, { ...frame, from: sender, to: undefined, stateVersion: taskCurrentStateVersion });
        return;
      }
      if (frame.type === 'request-open') {
        if (!frame.requestId || !frame.to || !this.socket(frame.to)) throw new Error('owner_offline');
        const active = [...this.streams.values()].filter((stream) => stream.requester === sender || stream.owner === sender).length;
        if (active >= maximumStreamsPerNode || this.streams.has(frame.requestId)) throw new Error('federation_capacity');
        this.streams.set(frame.requestId, { requester: sender, owner: frame.to, requestCredit: creditWindowBytes, responseCredit: creditWindowBytes });
        this.send(frame.to, { ...frame, to: undefined, headers: frame.headers ?? {} });
        return;
      }
      if (!frame.requestId) throw new Error('invalid_frame');
      const stream = this.streams.get(frame.requestId);
      if (!stream) throw new Error('unknown_request');
      if (frame.type === 'credit') {
        const direction = frame.direction;
        const bytes = Number(frame.bytes ?? 0);
        if ((direction !== 'request' && direction !== 'response') || bytes <= 0 || bytes > creditWindowBytes) throw new Error('invalid_credit');
        const receiver = direction === 'request' ? stream.owner : stream.requester;
        const creditDestination = direction === 'request' ? stream.requester : stream.owner;
        if (sender !== receiver) throw new Error('federation_forbidden');
        const creditKey = direction === 'request' ? 'requestCredit' : 'responseCredit';
        stream[creditKey] = Math.min(creditWindowBytes, stream[creditKey] + bytes);
        this.send(creditDestination, frame);
        return;
      }
      if (frame.type === 'cancel') {
        if (sender === stream.requester) this.send(stream.owner, frame);
        else if (sender === stream.owner) this.send(stream.requester, frame);
        else throw new Error('federation_forbidden');
        this.streams.delete(frame.requestId);
        return;
      }
      const requestDirection = frame.type.startsWith('request-');
      const source = requestDirection ? stream.requester : stream.owner;
      const destination = requestDirection ? stream.owner : stream.requester;
      if (sender !== source) throw new Error('federation_forbidden');
      if (frame.type === 'request-chunk' || frame.type === 'response-chunk') {
        const bytes = encodedByteLength(frame.data ?? '');
        if (bytes <= 0 || bytes > chunkBytes) throw new Error('federation_body_limit');
        const creditKey = requestDirection ? 'requestCredit' : 'responseCredit';
        if (stream[creditKey] < bytes) throw new Error('federation_credit');
        stream[creditKey] -= bytes;
        this.send(destination, frame);
        return;
      }
      this.send(destination, frame);
      if (frame.type === 'response-end' || frame.type === 'response-error') this.streams.delete(frame.requestId);
    } catch (error) {
      const code = (error instanceof Error ? error.message : 'invalid_frame').slice(0, 160);
      const payload = frame?.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
      const deliveryId = String(payload.deliveryId ?? '').slice(0, 160);
      try {
        console.error(JSON.stringify({ event: 'federation-relay-frame-rejected', nodeId: sender.slice(0, 160), frameType: String(frame?.type ?? '').slice(0, 80), projectId: String(frame?.projectId ?? '').slice(0, 160), deliveryId, code }));
      } catch {
        // Diagnostics must not escape the contained frame rejection.
      }
      socket.send(JSON.stringify({ version: 1, type: 'response-error', requestId: frame?.requestId, projectId: frame?.projectId, code, message: code, payload: { deliveryId } } satisfies RelayFrame));
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    const nodeId = (socket.deserializeAttachment() as SocketIdentity).nodeId;
    this.subscriptions.delete(nodeId);
    for (const [requestId, stream] of this.streams) {
      if (stream.owner === nodeId) this.send(stream.requester, { version: 1, type: 'response-error', requestId, code: 'owner_offline', message: 'Owner offline.' });
      if (stream.requester === nodeId) this.send(stream.owner, { version: 1, type: 'cancel', requestId });
      if (stream.owner === nodeId || stream.requester === nodeId) this.streams.delete(requestId);
    }
    await this.publishCatalog();
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    socket.close(1011, 'socket_error');
  }
}

/**
 * WHAT: Runs the epoch-4 relay implementation in the original stable Durable Object namespace.
 * WHY: Credentials and manifests are epoch-independent, while state:v3 and state:v4 keys
 * already isolate rollback state without rotating node credentials.
 */
export class FederationRelay extends FederationRelayV4 {}
