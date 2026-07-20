import { DurableObject } from 'cloudflare:workers';
import {
  chunkBytes,
  creditWindowBytes,
  encodedByteLength,
  maximumStreamsPerNode,
  parseFrame,
  priorityStateFrameTypes,
  protocolVersion,
  type ProjectManifest,
  type RelayFrame,
} from './protocol';

type Env = {
  FEDERATIONS: DurableObjectNamespace<FederationRelay>;
  ADMIN_SECRET: string;
};

type SocketIdentity = { nodeId: string };
type Stream = { requester: string; owner: string; requestCredit: number; responseCredit: number };
type StoredStateEvent = { sourceNodeId: string; event: Record<string, unknown> };
type StateBucket = { bucket: string; count: number; checksum: string };
type StoredStateSnapshot = {
  projectId: string;
  snapshotId: string;
  manifest: Record<string, unknown>;
  checksum: string;
  total: number;
};

const stateEventBatchSize = 128;

function stateEventPrefix(projectId: string, bucket = ''): string {
  return `state:event:${encodeURIComponent(projectId)}:${bucket ? `${encodeURIComponent(bucket)}:` : ''}`;
}

function stateEventKey(projectId: string, bucket: string, eventId: string): string {
  return `${stateEventPrefix(projectId, bucket)}${eventId}`;
}

function stateBucketPrefix(projectId: string): string {
  return `state:bucket:${encodeURIComponent(projectId)}:`;
}

function stateBucketKey(projectId: string, bucket: string): string {
  return `${stateBucketPrefix(projectId)}${encodeURIComponent(bucket)}`;
}

function stateSnapshotPointerKey(projectId: string): string {
  return `state:snapshot:${encodeURIComponent(projectId)}:current`;
}

function stateSnapshotChunkKey(projectId: string, snapshotId: string, index: number): string {
  return `state:snapshot:${encodeURIComponent(projectId)}:${encodeURIComponent(snapshotId)}:${index}`;
}

function stateSnapshotUploadPrefix(projectId: string, sender: string, transferId: string): string {
  return `state:snapshot-upload:${encodeURIComponent(projectId)}:${encodeURIComponent(sender)}:${encodeURIComponent(transferId)}:`;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function xorChecksums(checksums: string[]): string {
  const result = new Uint8Array(32);
  for (const checksum of checksums) {
    if (!/^[a-f0-9]{64}$/i.test(checksum)) continue;
    for (let index = 0; index < result.length; index += 1) result[index] ^= Number.parseInt(checksum.slice(index * 2, index * 2 + 2), 16);
  }
  return [...result].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function mismatchedBuckets(local: StateBucket[], remote: StateBucket[]): string[] {
  const localByName = new Map(local.map((entry) => [entry.bucket, entry]));
  return remote.filter((entry) => {
    const value = localByName.get(entry.bucket);
    return !value || value.count !== entry.count || value.checksum !== entry.checksum;
  }).map((entry) => entry.bucket);
}

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

function routeParts(url: URL): { federationId: string; nodeId?: string } | null {
  const connect = url.pathname.match(/^\/connect\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
  if (connect) return { federationId: connect[1], nodeId: connect[2] };
  const admin = url.pathname.match(/^\/admin\/federations\/([a-zA-Z0-9_-]+)\/nodes\/([a-zA-Z0-9_-]+)$/);
  return admin ? { federationId: admin[1], nodeId: admin[2] } : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'decision-os-federation-relay', protocolVersion });
    const route = routeParts(url);
    if (!route) return json({ ok: false, error: 'not_found' }, 404);
    const stub = env.FEDERATIONS.getByName(route.federationId, { locationHint: 'apac' });

    if (url.pathname.startsWith('/admin/')) {
      if (!env.ADMIN_SECRET) return json({ ok: false, error: 'relay_not_configured' }, 503);
      const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (!(await sameSecret(supplied, env.ADMIN_SECRET))) return json({ ok: false, error: 'federation_authentication' }, 401);
      if (request.method !== 'POST' || !route.nodeId) return json({ ok: false, error: 'method_not_allowed' }, 405);
      return stub.fetch(new Request(`https://relay.internal/admin/nodes/${route.nodeId}`, request));
    }

    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket' || !route.nodeId) {
      return json({ ok: false, error: 'websocket_required' }, 426);
    }
    return stub.fetch(new Request(`https://relay.internal/connect/${route.nodeId}`, request));
  },
} satisfies ExportedHandler<Env>;

export class FederationRelay extends DurableObject<Env> {
  private readonly streams = new Map<string, Stream>();
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

  private projectSockets(projectId: string): WebSocket[] {
    return this.activeSockets().filter((socket) => {
      const identity = socket.deserializeAttachment() as SocketIdentity | null;
      return Boolean(identity?.nodeId && this.hasProject(identity.nodeId, projectId));
    });
  }

  private assertProject(nodeId: string, projectId: string): void {
    if (!projectId || !this.hasProject(nodeId, projectId)) throw new Error('unknown_state_project');
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

  private async stateEvents(projectId: string): Promise<StoredStateEvent[]> {
    const entries = await listAll<StoredStateEvent>(this.ctx.storage, stateEventPrefix(projectId));
    return [...entries.values()];
  }

  private async stateBuckets(projectId: string): Promise<StateBucket[]> {
    const entries = await listAll<StateBucket>(this.ctx.storage, stateBucketPrefix(projectId));
    return [...entries.values()].sort((left, right) => left.bucket.localeCompare(right.bucket));
  }

  private async sendStateSummary(socket: WebSocket, projectId: string): Promise<void> {
    const buckets = await this.stateBuckets(projectId);
    this.sendSocket(socket, { version: 1, type: 'state-bucket-summary', from: 'relay', projectId, stateVersion: 1, payload: { buckets } });
  }

  private async sendStateSnapshotManifest(socket: WebSocket, projectId: string): Promise<void> {
    const snapshot = await this.ctx.storage.get<StoredStateSnapshot>(stateSnapshotPointerKey(projectId));
    if (!snapshot) return;
    this.sendSocket(socket, {
      version: 1,
      type: 'state-snapshot-manifest',
      from: 'relay',
      projectId,
      stateVersion: 1,
      payload: { manifests: [snapshot.manifest] },
    });
  }

  private sendStateEvents(socket: WebSocket, projectId: string, entries: StoredStateEvent[]): void {
    for (let index = 0; index < entries.length; index += stateEventBatchSize) {
      this.sendSocket(socket, {
        version: 1,
        type: 'state-event-batch',
        from: 'relay',
        projectId,
        stateVersion: 1,
        payload: { events: entries.slice(index, index + stateEventBatchSize).map((entry) => entry.event) },
      });
    }
  }

  private async persistStateEvents(sender: string, socket: WebSocket, frame: RelayFrame): Promise<void> {
    const projectId = String(frame.projectId ?? '');
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    const events = Array.isArray(payload.events) ? payload.events.filter((event): event is Record<string, unknown> => Boolean(event && typeof event === 'object')) : [];
    this.assertProject(sender, projectId);
    if (events.length === 0 || events.length > stateEventBatchSize) throw new Error('invalid_state_event_batch');
    const eventEntries = events.map((event) => {
      const eventId = String(event.eventId ?? '');
      if (!eventId || event.projectId !== projectId || typeof event.emittedAt !== 'string' || typeof event.checksum !== 'string') throw new Error('invalid_state_event');
      const bucket = event.emittedAt.slice(0, 13);
      return { key: stateEventKey(projectId, bucket, eventId), bucket, event };
    });
    await this.ctx.storage.transaction(async (transaction) => {
      const existing = await transaction.get<StoredStateEvent>(eventEntries.map((entry) => entry.key));
      const additions = eventEntries.filter((entry) => !existing.has(entry.key));
      for (const entry of eventEntries) {
        const previous = existing.get(entry.key);
        if (previous && JSON.stringify(previous.event) !== JSON.stringify(entry.event)) throw new Error('state_event_identity_collision');
      }
      if (additions.length === 0) return;
      const bucketNames = [...new Set(additions.map((entry) => entry.bucket))];
      const existingBuckets = await transaction.get<StateBucket>(bucketNames.map((bucket) => stateBucketKey(projectId, bucket)));
      await transaction.put(Object.fromEntries(additions.map((entry) => [entry.key, { sourceNodeId: sender, event: entry.event } satisfies StoredStateEvent])));
      await transaction.put(Object.fromEntries(bucketNames.map((bucket) => {
        const current = existingBuckets.get(stateBucketKey(projectId, bucket));
        const added = additions.filter((entry) => entry.bucket === bucket);
        const value: StateBucket = {
          bucket,
          count: (current?.count ?? 0) + added.length,
          checksum: xorChecksums([current?.checksum ?? '', ...added.map((entry) => String(entry.event.checksum))]),
        };
        return [stateBucketKey(projectId, bucket), value];
      })));
    });
    this.sendSocket(socket, { version: 1, type: 'state-relay-ack', from: 'relay', projectId, stateVersion: 1, payload: { eventIds: events.map((event) => event.eventId) } });
    for (const target of this.projectSockets(projectId)) {
      if (target !== socket) this.sendStateEvents(target, projectId, events.map((event) => ({ sourceNodeId: sender, event })));
    }
    for (const target of this.projectSockets(projectId)) await this.sendStateSummary(target, projectId);
  }

  private async reconcileStateSummary(sender: string, socket: WebSocket, frame: RelayFrame): Promise<void> {
    const projectId = String(frame.projectId ?? '');
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    const remote = Array.isArray(payload.buckets) ? payload.buckets as StateBucket[] : [];
    this.assertProject(sender, projectId);
    const local = await this.stateBuckets(projectId);
    const missingFromRelay = mismatchedBuckets(local, remote);
    if (missingFromRelay.length > 0) {
      this.sendSocket(socket, { version: 1, type: 'state-missing-request', from: 'relay', projectId, stateVersion: 1, payload: { buckets: missingFromRelay } });
    }
    this.sendSocket(socket, { version: 1, type: 'state-bucket-summary', from: 'relay', projectId, stateVersion: 1, payload: { buckets: local } });
    if (missingFromRelay.length === 0 && mismatchedBuckets(remote, local).length === 0) {
      this.sendSocket(socket, { version: 1, type: 'state-converged', from: 'relay', projectId, stateVersion: 1, payload: { buckets: local, nodeId: sender } });
    }
  }

  private async sendMissingStateEvents(sender: string, socket: WebSocket, frame: RelayFrame): Promise<void> {
    const projectId = String(frame.projectId ?? '');
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    const buckets = new Set(Array.isArray(payload.buckets) ? payload.buckets.map(String) : []);
    this.assertProject(sender, projectId);
    if (buckets.size === 0) throw new Error('invalid_state_missing_request');
    const pages = await Promise.all([...buckets].map((bucket) => listAll<StoredStateEvent>(this.ctx.storage, stateEventPrefix(projectId, bucket))));
    const events = pages.flatMap((page) => [...page.values()]);
    this.sendStateEvents(socket, projectId, events);
  }

  private async storeStateSnapshotChunk(sender: string, frame: RelayFrame): Promise<void> {
    const projectId = String(frame.projectId ?? '');
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    const transferId = String(payload.transferId ?? '');
    const index = Number(payload.index ?? -1);
    const total = Number(payload.total ?? 0);
    const checksum = String(payload.checksum ?? '');
    const data = String(payload.data ?? '');
    this.assertProject(sender, projectId);
    if (!transferId || index < 0 || total < 1 || index >= total || !/^[a-f0-9]{64}$/i.test(checksum) || !data) {
      throw new Error('invalid_state_snapshot_chunk');
    }
    await this.ctx.storage.put(`${stateSnapshotUploadPrefix(projectId, sender, transferId)}${index}`, { index, total, checksum, data });
  }

  private async finishStateSnapshotUpload(sender: string, socket: WebSocket, frame: RelayFrame): Promise<void> {
    const projectId = String(frame.projectId ?? '');
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    const transferId = String(payload.transferId ?? '');
    const total = Number(payload.total ?? 0);
    const checksum = String(payload.checksum ?? '');
    this.assertProject(sender, projectId);
    if (!transferId || total < 1 || !/^[a-f0-9]{64}$/i.test(checksum)) throw new Error('invalid_state_snapshot_end');
    const prefix = stateSnapshotUploadPrefix(projectId, sender, transferId);
    const uploads = await this.ctx.storage.list<{ index: number; total: number; checksum: string; data: string }>({ prefix });
    const chunks = [...uploads.values()].sort((left, right) => left.index - right.index);
    if (chunks.length !== total || chunks.some((chunk, index) => chunk.index !== index || chunk.total !== total || chunk.checksum !== checksum)) {
      throw new Error('incomplete_state_snapshot');
    }
    const decodedChunks = chunks.map((chunk) => Uint8Array.from(atob(chunk.data), (value) => value.charCodeAt(0)));
    const bytes = new Uint8Array(decodedChunks.reduce((size, chunk) => size + chunk.byteLength, 0));
    let offset = 0;
    for (const chunk of decodedChunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (await sha256(bytes) !== checksum) throw new Error('invalid_state_snapshot_transport_checksum');
    const snapshot = JSON.parse(new TextDecoder().decode(bytes)) as { manifest?: Record<string, unknown>; projection?: { projectId?: string; appliedEventIds?: unknown[] } };
    const snapshotId = String(snapshot.manifest?.snapshotId ?? '');
    const appliedEventIds = Array.isArray(snapshot.projection?.appliedEventIds) ? snapshot.projection.appliedEventIds.map(String) : [];
    if (!snapshotId || snapshot.manifest?.projectId !== projectId || snapshot.projection?.projectId !== projectId || Number(snapshot.manifest?.reducerVersion) !== 1) {
      throw new Error('incompatible_state_snapshot');
    }
    if (new Set(appliedEventIds).size !== appliedEventIds.length) throw new Error('state_snapshot_contains_duplicate_events');
    const knownEventIds = new Set((await this.stateEvents(projectId)).map((entry) => String(entry.event.eventId ?? '')));
    if (appliedEventIds.some((eventId) => !knownEventIds.has(eventId))) throw new Error('state_snapshot_contains_unknown_events');
    const current = await this.ctx.storage.get<StoredStateSnapshot>(stateSnapshotPointerKey(projectId));
    if (!current || appliedEventIds.length >= Number((current.manifest as { eventCount?: number }).eventCount ?? 0)) {
      for (let index = 0; index < chunks.length; index += 1) {
        await this.ctx.storage.put(stateSnapshotChunkKey(projectId, snapshotId, index), chunks[index].data);
      }
      const manifest = { ...snapshot.manifest, eventCount: appliedEventIds.length };
      await this.ctx.storage.put(stateSnapshotPointerKey(projectId), { projectId, snapshotId, manifest, checksum, total } satisfies StoredStateSnapshot);
      if (current && current.snapshotId !== snapshotId) {
        await this.ctx.storage.delete(Array.from({ length: current.total }, (_value, index) => stateSnapshotChunkKey(projectId, current.snapshotId, index)));
      }
      for (const target of this.projectSockets(projectId)) await this.sendStateSnapshotManifest(target, projectId);
    }
    await this.ctx.storage.delete([...uploads.keys()]);
    this.sendSocket(socket, { version: 1, type: 'state-ack', from: 'relay', projectId, stateVersion: 1, payload: { snapshotId } });
  }

  private async sendStateSnapshot(socket: WebSocket, frame: RelayFrame): Promise<void> {
    const projectId = String(frame.projectId ?? '');
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    const requestedSnapshotId = String(payload.snapshotId ?? '');
    const sender = (socket.deserializeAttachment() as SocketIdentity).nodeId;
    this.assertProject(sender, projectId);
    const snapshot = await this.ctx.storage.get<StoredStateSnapshot>(stateSnapshotPointerKey(projectId));
    if (!snapshot || (requestedSnapshotId && requestedSnapshotId !== snapshot.snapshotId)) return;
    const transferId = crypto.randomUUID();
    for (let index = 0; index < snapshot.total; index += 1) {
      const data = await this.ctx.storage.get<string>(stateSnapshotChunkKey(projectId, snapshot.snapshotId, index));
      if (!data) throw new Error('missing_state_snapshot_chunk');
      this.sendSocket(socket, {
        version: 1,
        type: 'state-snapshot-chunk',
        from: 'relay',
        projectId,
        stateVersion: 1,
        payload: { transferId, index, total: snapshot.total, checksum: snapshot.checksum, data },
      });
    }
    this.sendSocket(socket, {
      version: 1,
      type: 'state-snapshot-end',
      from: 'relay',
      projectId,
      stateVersion: 1,
      payload: { transferId, total: snapshot.total, checksum: snapshot.checksum },
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
      if (new TextEncoder().encode(text).byteLength > creditWindowBytes) throw new Error('federation_body_limit');
      frame = parseFrame(text);
      if (frame.type === 'manifest') {
        this.manifests.set(sender, Array.isArray(frame.projects) ? frame.projects : []);
        this.nodeLabels.set(sender, String(frame.nodeLabel || sender).slice(0, 120));
        await this.ctx.storage.put({ manifests: [...this.manifests], nodeLabels: [...this.nodeLabels] });
        await this.publishCatalog();
        for (const project of frame.projects ?? []) {
          const projectId = String(project.id ?? '');
          await this.sendStateSnapshotManifest(socket, projectId);
          await this.sendStateSummary(socket, projectId);
        }
        return;
      }
      if (frame.type === 'content-change') {
        for (const target of this.activeSockets()) {
          if (target !== socket) this.sendSocket(target, { version: 1, type: 'content-change', from: sender });
        }
        return;
      }
      if (priorityStateFrameTypes.has(frame.type)) {
        if (!frame.to) {
          if (frame.type === 'state-event-batch') await this.persistStateEvents(sender, socket, frame);
          else if (frame.type === 'state-bucket-summary') await this.reconcileStateSummary(sender, socket, frame);
          else if (frame.type === 'state-missing-request') await this.sendMissingStateEvents(sender, socket, frame);
          else if (frame.type === 'state-snapshot-chunk') await this.storeStateSnapshotChunk(sender, frame);
          else if (frame.type === 'state-snapshot-end') await this.finishStateSnapshotUpload(sender, socket, frame);
          else if (frame.type === 'state-snapshot-request') await this.sendStateSnapshot(socket, frame);
          else if (frame.type === 'state-ack' || frame.type === 'state-relay-ack' || frame.type === 'state-converged') return;
          else throw new Error('unsupported_relay_state_frame');
          return;
        }
        if (!frame.to || !this.socket(frame.to)) throw new Error('owner_offline');
        this.send(frame.to, { ...frame, from: sender, to: undefined, stateVersion: 1 });
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
