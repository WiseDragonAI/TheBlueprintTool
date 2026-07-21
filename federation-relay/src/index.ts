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
  hashTaskCurrentRoot,
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
  summarizeBucket,
  type StateBucket,
  type StateEntry,
} from './state-storage';

type Env = {
  FEDERATIONS: DurableObjectNamespace<FederationRelay>;
  ADMIN_SECRET: string;
};

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
    if (url.pathname === '/health') return json({ ok: true, service: 'decision-os-federation-relay', protocolVersion, stateProtocol, stateSchema, baselineEpoch: stateBaselineEpoch });
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

export class FederationRelay extends DurableObject<Env> {
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

  private async stateRoot(projectId: string): Promise<string> {
    return hashTaskCurrentRoot(await this.stateBuckets(projectId));
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
    const resetAt = new Date().toISOString();
    await this.ctx.storage.put(`state:v3:reset:${encodeURIComponent(projectId)}:${resetAt}`, { projectId, resetAt, entitiesDeleted, bucketsDeleted });
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
    });
    const root = await this.stateRoot(projectId);
    this.sendSocket(socket, { version: 1, type: 'state-relay-ack', from: 'relay', projectId, stateVersion: taskCurrentStateVersion, payload: { stateVersion: taskCurrentStateVersion, deliveryId, accepted, root } });
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
    const local = await this.stateBuckets(projectId);
    const missingFromRelay = mismatchedBuckets(local, remote);
    if (missingFromRelay.length > 0) {
      this.sendSocket(socket, { version: 1, type: 'state-missing-request', from: 'relay', projectId, stateVersion: taskCurrentStateVersion, payload: { stateVersion: taskCurrentStateVersion, buckets: missingFromRelay } });
    }
    const localRoot = hashTaskCurrentRoot(local);
    this.sendSocket(socket, { version: 1, type: 'state-bucket-summary', from: 'relay', projectId, stateVersion: taskCurrentStateVersion, payload: { stateVersion: taskCurrentStateVersion, root: localRoot, buckets: local } });
    if (missingFromRelay.length === 0 && payload.root === localRoot) {
      this.sendSocket(socket, { version: 1, type: 'state-converged', from: 'relay', projectId, stateVersion: taskCurrentStateVersion, payload: { stateVersion: taskCurrentStateVersion, nodeId: sender, root: localRoot } });
    }
  }

  private async sendMissingStateEntities(sender: string, socket: WebSocket, frame: RelayFrame): Promise<void> {
    const projectId = String(frame.projectId ?? '');
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    const buckets = new Set(Array.isArray(payload.buckets) ? payload.buckets.map(String) : []);
    this.assertProjectParticipation(sender, projectId);
    if (buckets.size === 0) throw new Error('invalid_state_missing_request');
    const pages = await Promise.all([...buckets].map((bucket) => listAll<RelayEntity>(this.ctx.storage, stateEntityPrefix(projectId, bucket))));
    this.sendStateEntities(socket, projectId, pages.flatMap((page) => [...page.values()]));
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
      const code = error instanceof Error ? error.message : 'invalid_frame';
      socket.send(JSON.stringify({ version: 1, type: 'response-error', requestId: frame?.requestId, code, message: code } satisfies RelayFrame));
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
