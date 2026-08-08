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
  assertFederationRepairAttempt,
  assertFederationRepairManifest,
  canonicalFederationRepairBuckets,
  createFederationRepairRecord,
  federationRepairRecordKey,
  type FederationRepairRecord,
} from '../../shared/federation-repair-guard';
import {
  hashTaskCurrentRoot,
  taskCurrentBucketForEntityKey,
  taskCurrentEntityKey,
  taskCurrentStateVersion,
} from '../../shared/task-current-state-core';
import {
  admitStateEntries,
  mismatchedBuckets,
  stateBucketKey,
  stateBucketPrefix,
  stateEntityBatchSize,
  stateEntityPrefix,
  stateEntityStorageKey,
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

type RepairWindowSession = {
  summaries: Set<string>;
  buckets: Map<string, Set<string>>;
  projects: string[];
  deliveries: Map<string, { projectId: string; encodedBytes: number }>;
  pumping: boolean;
};

const maximumRepairBatchesPerProject = 4;
const maximumRepairBatchesPerConnection = 16;
const maximumRepairBytesPerConnection = 16 * 1024 * 1024;
const repairEncoder = new TextEncoder();

type SocketIdentity = { nodeId: string };
type Stream = { requester: string; owner: string; requestCredit: number; responseCredit: number };
type RelayRoute =
  | { kind: 'connect'; federationId: string; nodeId: string }
  | { kind: 'provision-node'; federationId: string; nodeId: string }
  | { kind: 'reset-project-state'; federationId: string; projectId: string };
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
  return reset ? { kind: 'reset-project-state', federationId: reset[1], projectId: reset[2] } : null;
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
      if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
      const path = route.kind === 'reset-project-state'
        ? `/admin/projects/${route.projectId}/reset-state`
        : `/admin/nodes/${route.nodeId}`;
      return stub.fetch(new Request(`https://relay.internal${path}`, request));
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
  private readonly repairSessions = new WeakMap<WebSocket, RepairWindowSession>();
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

  private repairSession(socket: WebSocket): RepairWindowSession {
    const existing = this.repairSessions.get(socket);
    // WHAT: Reuse all connection-owned flow-control counters when the socket already has a session.
    // WHY: Duplicate requests on one connection must share one bounded repair budget.
    if (existing) return existing;
    const created: RepairWindowSession = { summaries: new Set(), buckets: new Map(), projects: [], deliveries: new Map(), pumping: false };
    this.repairSessions.set(socket, created);
    return created;
  }

  private async repairEntries(projectId: string, buckets: string[]): Promise<Array<{ key: string; stateHash: string }>> {
    const values: Array<{ key: string; stateHash: string }> = [];
    for (const bucket of buckets) {
      const page = await listAll<RelayEntity>(this.ctx.storage, stateEntityPrefix(projectId, bucket));
      values.push(...[...page.values()].map((entity) => ({ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash })));
    }
    return values.sort((left, right) => left.key.localeCompare(right.key));
  }

  private async pumpRepairWindow(sender: string, socket: WebSocket): Promise<void> {
    const session = this.repairSession(socket);
    // WHAT: Coalesce acknowledgement and request callbacks into one connection scheduler.
    // WHY: Concurrent callbacks must not oversubscribe the batch or byte windows.
    if (session.pumping) return;
    session.pumping = true;
    try {
      let idleProjects = 0;
      while (session.projects.length > 0 && session.deliveries.size < maximumRepairBatchesPerConnection) {
        const encodedInFlight = [...session.deliveries.values()].reduce((total, delivery) => total + delivery.encodedBytes, 0);
        // WHAT: Stop admission at the connection-wide encoded-byte ceiling.
        // WHY: A large catalog must remain bounded independently of entity count.
        if (encodedInFlight >= maximumRepairBytesPerConnection) break;
        const projectId = session.projects.shift()!;
        session.projects.push(projectId);
        const recordKey = federationRepairRecordKey(sender, projectId);
        const record = await this.ctx.storage.get<FederationRepairRecord>(recordKey);
        // WHAT: Remove a project whose durable repair authority no longer exists.
        // WHY: The scheduler cannot infer work after reset or explicit completion cleanup.
        if (!record) {
          session.projects = session.projects.filter((candidate) => candidate !== projectId);
          continue;
        }
        const pending = record.pendingDeliveries ?? [];
        const remaining = record.remainingEntries ?? [];
        // WHAT: Finish scheduling only after every queued and in-flight entry settles.
        // WHY: Terminal summaries before acknowledgement can report false completion.
        if (remaining.length === 0 && pending.length === 0) {
          // WHAT: Persist and emit the terminal summary once for the emptied attempt.
          // WHY: Repeated scheduler passes must not fan out unchanged convergence traffic.
          if (!record.summarySent) {
            record.summarySent = true;
            await this.ctx.storage.put(recordKey, record);
            await this.sendStateSummary(socket, projectId);
          }
          session.projects = session.projects.filter((candidate) => candidate !== projectId);
          idleProjects = 0;
          continue;
        }
        // WHAT: Leave this project queued when its four-batch window is full.
        // WHY: Acknowledgement must advance the project window.
        if (pending.length >= maximumRepairBatchesPerProject || remaining.length === 0) {
          idleProjects += 1;
          // WHAT: End the scheduler after one complete pass made no admission.
          // WHY: All projects are waiting for acknowledgement and another loop would spin.
          if (idleProjects >= session.projects.length) break;
          continue;
        }
        const candidates = remaining.slice(0, stateEntityBatchSize);
        const storageKeys = candidates.map((entry) => stateEntityStorageKey(projectId, taskCurrentBucketForEntityKey(entry.key), entry.key));
        const stored = await this.ctx.storage.get<RelayEntity>(storageKeys);
        const entities = storageKeys.map((key) => stored.get(key));
        // WHAT: Reject a repair whose referenced durable entity disappeared.
        // WHY: Sending an incomplete frame would make the attempt silently unfinishable.
        if (entities.some((entity) => !entity)) throw new Error('missing_repair_entity');
        const frame = stateEntityFrames(projectId, entities as RelayEntity[])[0];
        frame.payload = { ...(frame.payload as Record<string, unknown>), attemptId: record.attemptId };
        const payload = frame.payload as { deliveryId: string; entries: Array<{ key: string; stateHash: string }> };
        const encodedBytes = repairEncoder.encode(JSON.stringify(frame)).byteLength;
        // WHAT: Defer this frame when another in-flight frame leaves insufficient byte credit.
        // WHY: The connection-wide byte ceiling must hold before socket send.
        if (encodedInFlight + encodedBytes > maximumRepairBytesPerConnection && session.deliveries.size > 0) break;
        const sentKeys = new Set(payload.entries.map((entry) => entry.key));
        record.remainingEntries = remaining.filter((entry) => !sentKeys.has(entry.key));
        record.pendingDeliveries = [...pending, { deliveryId: payload.deliveryId, entries: payload.entries.map(({ key, stateHash }) => ({ key, stateHash })), encodedBytes }];
        record.summarySent = false;
        await this.ctx.storage.put(recordKey, record);
        session.deliveries.set(payload.deliveryId, { projectId, encodedBytes });
        this.sendSocket(socket, frame);
        idleProjects = 0;
      }
    } finally {
      session.pumping = false;
    }
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
    await this.ctx.storage.transaction(async (transaction) => {
      const existing = await transaction.get<RelayEntity>(entries.map((entry) => entry.key));
      const joined = entries.map((entry) => ({ ...entry, value: joinRelayEntity(existing.get(entry.key), entry.entity) }));
      accepted.push(...joined.map((entry) => ({ key: entry.entityKey, stateHash: entry.value.stateHash })));
      const additions = joined.filter((entry) => existing.get(entry.key)?.stateHash !== entry.value.stateHash);
      // WHAT: Leave the relay root generation unchanged when every accepted entity is already durable.
      // WHY: Duplicate deliveries must not create a fresh repair budget.
      if (additions.length === 0) return;
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
      const generationKey = this.stateGenerationKey(projectId);
      const generation = await transaction.get<number>(generationKey) ?? 0;
      await transaction.put(generationKey, generation + 1);
    });
    this.sendSocket(socket, { version: 1, type: 'state-relay-ack', from: 'relay', projectId, stateVersion: taskCurrentStateVersion, payload: { stateVersion: taskCurrentStateVersion, deliveryId, accepted } });
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
    const session = this.repairSession(socket);
    const summaryIdentity = `${projectId}\u0000${generation}\u0000${peerRoot}\u0000${peerManifestDigest}`;
    // WHAT: Suppress an identical summary only within the current connection.
    // WHY: Reconnect must retry work whose prior transport delivery was never durably applied.
    if (session.summaries.has(summaryIdentity)) return;
    session.summaries.add(summaryIdentity);
    const local = await this.stateBuckets(projectId);
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
    const session = this.repairSession(socket);
    // WHAT: Preserve bounded legacy service when optional continuation metadata is absent.
    // WHY: Epoch-4 compatibility requires old nodes to keep synchronizing without completion claims.
    if (!payload.attemptId || !payload.relayRoot || !payload.receiverRoot) {
      const served = session.buckets.get(projectId) ?? new Set<string>();
      const admitted = buckets.filter((bucket) => !served.has(bucket));
      for (const bucket of admitted) served.add(bucket);
      session.buckets.set(projectId, served);
      // WHAT: Suppress a legacy request when every selected bucket was already served on this socket.
      // WHY: Old epoch-4 requests lack durable acknowledgement authority for finer continuation.
      if (admitted.length === 0) return;
      const entities: RelayEntity[] = [];
      for (const bucket of admitted) {
        const page = await listAll<RelayEntity>(this.ctx.storage, stateEntityPrefix(projectId, bucket));
        entities.push(...page.values());
      }
      this.sendStateEntities(socket, projectId, entities);
      await this.sendStateSummary(socket, projectId);
      return;
    }
    const attemptId = assertFederationRepairAttempt(payload.attemptId, 'attemptId');
    const relayRoot = assertFederationRepairAttempt(payload.relayRoot, 'relayRoot');
    const receiverRoot = assertFederationRepairAttempt(payload.receiverRoot, 'receiverRoot');
    const attemptSessionIdentity = `attempt:${projectId}:${attemptId}`;
    // WHAT: Suppress an identical enhanced request within the current connection.
    // WHY: Only socket replacement can make previously sent unacknowledged frames eligible again.
    if (session.summaries.has(attemptSessionIdentity)) return;
    session.summaries.add(attemptSessionIdentity);
    const localBuckets = await this.stateBuckets(projectId);
    const currentRelayRoot = hashTaskCurrentRoot(localBuckets);
    // WHAT: Return the current summary when the request names a superseded relay cut.
    // WHY: Entries from another durable root cannot complete this attempt safely.
    if (relayRoot !== currentRelayRoot) {
      await this.sendStateSummary(socket, projectId);
      return;
    }
    const generation = await this.ctx.storage.get<number>(this.stateGenerationKey(projectId)) ?? 0;
    const recordKey = federationRepairRecordKey(sender, projectId);
    const retained = await this.ctx.storage.get<FederationRepairRecord>(recordKey);
    const sameAttempt = retained?.attemptId === attemptId && retained.generation === generation && retained.relayRoot === relayRoot;
    let record: FederationRepairRecord;
    // WHAT: Continue acknowledged progress when reconnect names the same durable attempt.
    // WHY: Confirmed entries must never be resent after socket replacement.
    if (sameAttempt) {
      const requeued = [...(retained.remainingEntries ?? []), ...(retained.pendingDeliveries ?? []).flatMap((delivery) => delivery.entries)];
      const acknowledged = retained.acknowledgedEntries ?? {};
      record = {
        ...retained,
        receiverRoot,
        remainingEntries: [...new Map(requeued.filter((entry) => acknowledged[entry.key] !== entry.stateHash).map((entry) => [entry.key, entry])).values()],
        pendingDeliveries: [],
        summarySent: false,
      };
    } else {
      record = {
        ...createFederationRepairRecord({ nodeId: sender, projectId, generation, peerRoot: receiverRoot, peerManifestDigest: relayRoot }),
        attemptId,
        relayRoot,
        receiverRoot,
        requestedBuckets: buckets,
        remainingEntries: await this.repairEntries(projectId, buckets),
        pendingDeliveries: [],
        acknowledgedEntries: {},
        summarySent: false,
      };
    }
    await this.ctx.storage.put(recordKey, record);
    for (const [deliveryId, delivery] of session.deliveries) {
      // WHAT: Retire only transport deliveries owned by the restarted project attempt.
      // WHY: Reconnecting one project must not release another project's global byte credit.
      if (delivery.projectId === projectId) session.deliveries.delete(deliveryId);
    }
    // WHAT: Add this project once to the connection round-robin scheduler.
    // WHY: Duplicate requests must share one project window and one global budget.
    if (!session.projects.includes(projectId)) session.projects.unshift(projectId);
    await this.pumpRepairWindow(sender, socket);
  }

  private async acknowledgeStateDelivery(sender: string, socket: WebSocket, frame: RelayFrame): Promise<void> {
    const projectId = String(frame.projectId ?? '');
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    this.assertProjectParticipation(sender, projectId);
    const deliveryId = String(payload.deliveryId ?? '');
    const attemptId = assertFederationRepairAttempt(payload.attemptId, 'attemptId');
    const accepted = Array.isArray(payload.accepted) ? payload.accepted as Array<{ key?: string; stateHash?: string }> : [];
    const recordKey = federationRepairRecordKey(sender, projectId);
    const record = await this.ctx.storage.get<FederationRepairRecord>(recordKey);
    const delivery = record?.pendingDeliveries?.find((candidate) => candidate.deliveryId === deliveryId);
    // WHAT: Reject an acknowledgement outside the exact active attempt and delivery.
    // WHY: Only correlated durable receiver application may advance the repair window.
    if (!record || record.attemptId !== attemptId || !delivery) throw new Error('invalid_state_acknowledgement');
    const acceptedMap = new Map(accepted.map((entry) => [String(entry.key ?? ''), String(entry.stateHash ?? '')]));
    // WHAT: Require every submitted key and hash to be acknowledged exactly once.
    // WHY: Partial acknowledgement cannot prove the omitted entries reached durable state.
    if (acceptedMap.size !== delivery.entries.length || delivery.entries.some((entry) => acceptedMap.get(entry.key) !== entry.stateHash)) {
      throw new Error('invalid_state_acknowledgement');
    }
    record.acknowledgedEntries = { ...(record.acknowledgedEntries ?? {}), ...Object.fromEntries(delivery.entries.map((entry) => [entry.key, entry.stateHash])) };
    record.pendingDeliveries = (record.pendingDeliveries ?? []).filter((candidate) => candidate.deliveryId !== deliveryId);
    await this.ctx.storage.put(recordKey, record);
    const session = this.repairSession(socket);
    session.deliveries.delete(deliveryId);
    // WHAT: Return the acknowledged project to the round-robin queue.
    // WHY: Each durable acknowledgement must immediately admit the next bounded batch.
    if (!session.projects.includes(projectId)) session.projects.push(projectId);
    await this.pumpRepairWindow(sender, socket);
  }

  private async completeStateRepair(sender: string, socket: WebSocket, frame: RelayFrame): Promise<void> {
    const projectId = String(frame.projectId ?? '');
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    this.assertProjectParticipation(sender, projectId);
    // WHAT: Ignore legacy convergence frames that do not claim resumable attempt authority.
    // WHY: Old epoch-4 nodes remain compatible but cannot complete the enhanced durable attempt.
    if (!payload.attemptId) return;
    const attemptId = assertFederationRepairAttempt(payload.attemptId, 'attemptId');
    const root = assertFederationRepairAttempt(payload.root, 'relayRoot');
    const recordKey = federationRepairRecordKey(sender, projectId);
    const record = await this.ctx.storage.get<FederationRepairRecord>(recordKey);
    const currentRoot = hashTaskCurrentRoot(await this.stateBuckets(projectId));
    // WHAT: Complete only an empty attempt whose receiver confirms the current relay root.
    // WHY: Sent, pending, stale-cut, and unequal-root attempts remain retryable instead of becoming silent.
    if (!record || record.attemptId !== attemptId || record.remainingEntries?.length || record.pendingDeliveries?.length || root !== currentRoot) {
      throw new Error('invalid_state_convergence');
    }
    record.servedBuckets = [...(record.requestedBuckets ?? [])];
    record.completedAt = new Date().toISOString();
    await this.ctx.storage.put(recordKey, record);
    const session = this.repairSession(socket);
    session.projects = session.projects.filter((candidate) => candidate !== projectId);
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
    server.serializeAttachment({ nodeId: connect[1] } satisfies SocketIdentity);
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
          // WHAT: Advance enhanced repair only from durable receiver acknowledgement.
          // WHY: Socket delivery alone cannot release relay flow-control credit.
          else if (frame.type === 'state-relay-ack' || frame.type === 'state-ack') await this.acknowledgeStateDelivery(sender, socket, frame);
          // WHAT: Complete an emptied attempt only from the receiver's equal-root frame.
          // WHY: Pending or unequal attempts must remain retryable across reconnect.
          else if (frame.type === 'state-converged') await this.completeStateRepair(sender, socket, frame);
          else if (frame.type === 'state-summary-request') throw new Error('state_summary_request_requires_target');
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
      const payload = frame?.payload && typeof frame.payload === 'object'
        ? frame.payload as Record<string, unknown>
        : {};
      const deliveryId = String(payload.deliveryId ?? '').slice(0, 160);
      // WHAT: Record a bounded rejection event with the sender and delivery correlation available on the rejected frame.
      // WHY: Operators need to connect a relay rejection to the exact node, project, frame, and durable delivery attempt.
      try {
        console.error(JSON.stringify({
          event: 'federation-relay-frame-rejected',
          nodeId: sender.slice(0, 160),
          frameType: String(frame?.type ?? 'unknown').slice(0, 160),
          projectId: String(frame?.projectId ?? '').slice(0, 160),
          deliveryId,
          code,
        }));
      } catch {
        // WHAT: Contain diagnostic serialization and transport failures inside the rejected frame scope.
        // WHY: A diagnostic failure must not terminate the relay session or hide the response error.
      }
      socket.send(JSON.stringify({
        version: 1,
        type: 'response-error',
        requestId: frame?.requestId,
        projectId: frame?.projectId,
        code,
        message: code,
        payload: { deliveryId },
      } satisfies RelayFrame));
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
