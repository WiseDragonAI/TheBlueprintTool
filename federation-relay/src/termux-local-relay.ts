/**
 * WHAT: Runs the development federation relay directly on Termux with Node and ws.
 * WHY: Cloudflare workerd has no Android build, while the phone canary still needs
 * an isolated, durable, protocol-compatible relay boundary.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import {
  creditWindowBytes,
  maximumStateFrameBytes,
  maximumStreamsPerNode,
  parseFrame,
  priorityStateFrameTypes,
  protocolVersion,
  stateBaselineEpoch,
  stateProtocol,
  stateSchema,
  assertStateManifest,
  type ProjectManifest,
  type RelayFrame,
} from './protocol.js';
import { joinRelayEntity, type RelayEntity } from './current-state.js';
import { stateEntityFrames } from './state-entity-frames.js';
import {
  assertFederationRepairAttempt,
  assertFederationRepairManifest,
  canonicalFederationRepairBuckets,
  createFederationRepairRecord,
  federationRepairRecordKey,
  type FederationRepairRecord,
} from '../../shared/federation-repair-guard.js';
import {
  hashTaskCurrentRoot,
  taskCurrentBucketForEntityKey,
  taskCurrentEntityKey,
  taskCurrentStateVersion,
} from '../../shared/task-current-state-core.js';
import {
  admitStateEntries,
  mismatchedBuckets,
  stateEntityBatchSize,
  summarizeBucket,
  type StateBucket,
  type StateEntry,
} from './state-storage.js';

type StoredFederation = {
  credentials: Record<string, string>;
  manifests: Record<string, ProjectManifest[]>;
  labels: Record<string, string>;
  entities: Record<string, Record<string, RelayEntity>>;
  stateGenerations?: Record<string, number>;
  stateBroadcastGenerations?: Record<string, number>;
  stateRepairRecords?: Record<string, FederationRepairRecord>;
};

type StoredRelayState = {
  version: 1;
  federations: Record<string, StoredFederation>;
};

type Client = {
  federationId: string;
  nodeId: string;
  socket: WebSocket;
};

type Stream = {
  requester: string;
  owner: string;
  requestCredit: number;
  responseCredit: number;
};

type RepairWindowSession = {
  summaries: Set<string>;
  buckets: Map<string, Set<string>>;
  projects: string[];
  deliveries: Map<string, { projectId: string; encodedBytes: number }>;
  pumping: boolean;
};

const host = String(process.env.HOST ?? '127.0.0.1');
const port = Number(process.env.PORT ?? 50152);
const releaseSha = String(process.env.DECISION_OS_RELEASE_SHA ?? '');
const stateFile = resolve(String(process.env.DECISION_OS_RELAY_STATE_FILE ?? '.wrangler/state-termux/relay.json'));
const repairStateFile = `${stateFile}.repairs`;
const administratorSecret = String(process.env.ADMIN_SECRET ?? '');
const maximumFrameBytes = 1024 * 1024;
const maximumRepairBatchesPerProject = 4;
const maximumRepairBatchesPerConnection = 16;
const maximumRepairBytesPerConnection = 16 * 1024 * 1024;

if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('invalid_termux_relay_port');
if (!/^[a-f0-9]{40}$/.test(releaseSha)) throw new Error('invalid_termux_relay_release_sha');
if (administratorSecret.length < 32) throw new Error('invalid_termux_relay_admin_secret');

function emptyFederation(): StoredFederation {
  return { credentials: {}, manifests: {}, labels: {}, entities: {}, stateGenerations: {}, stateBroadcastGenerations: {}, stateRepairRecords: {} };
}

function readState(): StoredRelayState {
  try {
    const parsed = JSON.parse(readFileSync(stateFile, 'utf8')) as StoredRelayState;
    if (parsed.version !== 1 || !parsed.federations || typeof parsed.federations !== 'object') {
      throw new Error('invalid_termux_relay_state');
    }
    return parsed;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { version: 1, federations: {} };
    }
    throw error;
  }
}

let state = readState();
try {
  const repairs = JSON.parse(readFileSync(repairStateFile, 'utf8')) as { version: 1; federations: Record<string, Record<string, FederationRepairRecord>> };
  // WHAT: Reject an invalid repair sidecar before installing restart authority.
  // WHY: Corrupt acknowledgement progress must not be interpreted as completed transfer.
  if (repairs.version !== 1 || !repairs.federations || typeof repairs.federations !== 'object') throw new Error('invalid_termux_relay_repair_state');
  for (const [federationId, records] of Object.entries(repairs.federations)) {
    state.federations[federationId] ??= emptyFederation();
    state.federations[federationId].stateRepairRecords = records;
  }
} catch (error) {
  // WHAT: Treat only a missing sidecar as an empty upgrade state.
  // WHY: Existing epoch-4 relay files predate the disjoint repair-progress namespace.
  if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
}
const repairSessions = new WeakMap<WebSocket, RepairWindowSession>();

function persistState(): void {
  mkdirSync(dirname(stateFile), { recursive: true });
  const temporary = `${stateFile}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(state, (key, value) => key === 'stateRepairRecords' ? undefined : value)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, stateFile);
}

function persistRepairState(): void {
  mkdirSync(dirname(repairStateFile), { recursive: true });
  const temporary = `${repairStateFile}.tmp-${process.pid}`;
  const federations = Object.fromEntries(Object.entries(state.federations).map(([federationId, stored]) => [federationId, stored.stateRepairRecords ?? {}]));
  writeFileSync(temporary, `${JSON.stringify({ version: 1, federations })}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, repairStateFile);
}

function federation(federationId: string): StoredFederation {
  state.federations[federationId] ??= emptyFederation();
  const stored = state.federations[federationId];
  stored.stateGenerations ??= {};
  stored.stateBroadcastGenerations ??= {};
  stored.stateRepairRecords ??= {};
  return stored;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sameSecret(left: string, right: string): boolean {
  const a = Buffer.from(digest(left), 'hex');
  const b = Buffer.from(digest(right), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

function bearer(request: IncomingMessage): string {
  return String(request.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
}

const clients = new Map<string, Client>();
const subscriptions = new Map<string, Set<string>>();
const streams = new Map<string, Stream>();

function clientKey(federationId: string, nodeId: string): string {
  return `${federationId}\0${nodeId}`;
}

function streamKey(federationId: string, requestId: string): string {
  return `${federationId}\0${requestId}`;
}

function client(federationId: string, nodeId: string): Client | undefined {
  return clients.get(clientKey(federationId, nodeId));
}

function sendSocket(socket: WebSocket, frame: RelayFrame): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(frame));
}

function send(federationId: string, nodeId: string, frame: RelayFrame): void {
  const target = client(federationId, nodeId);
  if (target) sendSocket(target.socket, frame);
}

function activeClients(federationId: string): Client[] {
  return [...clients.values()].filter((entry) => entry.federationId === federationId && entry.socket.readyState === WebSocket.OPEN);
}

function participates(federationId: string, nodeId: string, projectId: string): boolean {
  const stored = federation(federationId);
  return (stored.manifests[nodeId] ?? []).some((project) => project.id === projectId)
    || (subscriptions.get(clientKey(federationId, nodeId))?.has(projectId) ?? false);
}

function publishCatalog(federationId: string): void {
  const stored = federation(federationId);
  const online = new Set(activeClients(federationId).map((entry) => entry.nodeId));
  const nodes = Object.entries(stored.manifests).map(([nodeId, projects]) => ({
    nodeId,
    nodeLabel: stored.labels[nodeId] || nodeId,
    projects,
    online: online.has(nodeId),
  }));
  for (const target of activeClients(federationId)) {
    sendSocket(target.socket, { version: 1, type: 'catalog', nodes });
  }
}

function stateBuckets(federationId: string, projectId: string): StateBucket[] {
  const entities = federation(federationId).entities[projectId] ?? {};
  const buckets = new Map<string, Record<string, string>>();
  for (const [entityKey, entity] of Object.entries(entities)) {
    const bucket = taskCurrentBucketForEntityKey(entityKey);
    const entries = buckets.get(bucket) ?? {};
    entries[entityKey] = entity.stateHash;
    buckets.set(bucket, entries);
  }
  return [...buckets].sort(([left], [right]) => left.localeCompare(right))
    .map(([bucket, entries]) => summarizeBucket(bucket, entries));
}

function sendStateSummary(target: Client, projectId: string): void {
  const buckets = stateBuckets(target.federationId, projectId);
  sendSocket(target.socket, {
    version: 1,
    type: 'state-bucket-summary',
    from: 'relay',
    projectId,
    stateVersion: taskCurrentStateVersion,
    payload: { stateVersion: taskCurrentStateVersion, root: hashTaskCurrentRoot(buckets), buckets },
  });
}

function sendStateEntities(target: Client, projectId: string, bucketNames?: Set<string>): void {
  const entities = Object.entries(federation(target.federationId).entities[projectId] ?? {})
    .filter(([key]) => !bucketNames || bucketNames.has(taskCurrentBucketForEntityKey(key)))
    .map(([, entity]) => entity);
  for (const frame of stateEntityFrames(projectId, entities)) sendSocket(target.socket, frame);
}

function repairSession(socket: WebSocket): RepairWindowSession {
  const existing = repairSessions.get(socket);
  // WHAT: Reuse connection-owned flow-control counters for every repair callback.
  // WHY: Duplicate requests must share one bounded batch and byte budget.
  if (existing) return existing;
  const created: RepairWindowSession = { summaries: new Set(), buckets: new Map(), projects: [], deliveries: new Map(), pumping: false };
  repairSessions.set(socket, created);
  return created;
}

function repairEntries(target: Client, projectId: string, buckets: string[]): Array<{ key: string; stateHash: string }> {
  const requested = new Set(buckets);
  return Object.entries(federation(target.federationId).entities[projectId] ?? {})
    .filter(([key]) => requested.has(taskCurrentBucketForEntityKey(key)))
    .map(([key, entity]) => ({ key, stateHash: entity.stateHash }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function pumpRepairWindow(target: Client): void {
  const session = repairSession(target.socket);
  // WHAT: Coalesce acknowledgement and request callbacks into one scheduler.
  // WHY: Reentrant callbacks must not oversubscribe the flow-control window.
  if (session.pumping) return;
  session.pumping = true;
  try {
    let idleProjects = 0;
    while (session.projects.length > 0 && session.deliveries.size < maximumRepairBatchesPerConnection) {
      const encodedInFlight = [...session.deliveries.values()].reduce((total, delivery) => total + delivery.encodedBytes, 0);
      // WHAT: Stop admission at the connection-wide byte ceiling.
      // WHY: A large catalog must remain bounded independently of entity count.
      if (encodedInFlight >= maximumRepairBytesPerConnection) break;
      const projectId = session.projects.shift()!;
      session.projects.push(projectId);
      const stored = federation(target.federationId);
      const recordKey = federationRepairRecordKey(target.nodeId, projectId);
      const record = stored.stateRepairRecords![recordKey];
      // WHAT: Remove projects whose durable repair authority no longer exists.
      // WHY: Reset or completion cleanup leaves no work for the scheduler to infer.
      if (!record) {
        session.projects = session.projects.filter((candidate) => candidate !== projectId);
        continue;
      }
      const pending = record.pendingDeliveries ?? [];
      const remaining = record.remainingEntries ?? [];
      // WHAT: Emit the terminal summary only after queued and in-flight work settles.
      // WHY: Socket send cannot prove durable receiver application.
      if (remaining.length === 0 && pending.length === 0) {
        // WHAT: Persist and emit one terminal summary for the emptied attempt.
        // WHY: Scheduler reentry must not fan out unchanged convergence traffic.
        if (!record.summarySent) {
          record.summarySent = true;
          persistRepairState();
          sendStateSummary(target, projectId);
        }
        session.projects = session.projects.filter((candidate) => candidate !== projectId);
        idleProjects = 0;
        continue;
      }
      // WHAT: Leave this project queued while its four-batch window is full.
      // WHY: Durable acknowledgement owns admission of the next frame.
      if (pending.length >= maximumRepairBatchesPerProject || remaining.length === 0) {
        idleProjects += 1;
        // WHAT: Stop after one complete round-robin pass made no admission.
        // WHY: Another loop would spin while all projects await acknowledgements.
        if (idleProjects >= session.projects.length) break;
        continue;
      }
      const candidates = remaining.slice(0, stateEntityBatchSize);
      const project = stored.entities[projectId] ?? {};
      const entities = candidates.map((entry) => project[entry.key]);
      // WHAT: Reject a repair whose referenced durable entity disappeared.
      // WHY: An incomplete response cannot converge to the advertised relay root.
      if (entities.some((entity) => !entity)) throw new Error('missing_repair_entity');
      const frame = stateEntityFrames(projectId, entities as RelayEntity[])[0];
      frame.payload = { ...(frame.payload as Record<string, unknown>), attemptId: record.attemptId };
      const payload = frame.payload as { deliveryId: string; entries: Array<{ key: string; stateHash: string }> };
      const encodedBytes = Buffer.byteLength(JSON.stringify(frame));
      // WHAT: Defer this frame when another frame consumes the remaining byte credit.
      // WHY: The connection-wide encoded-byte ceiling must hold before socket send.
      if (encodedInFlight + encodedBytes > maximumRepairBytesPerConnection && session.deliveries.size > 0) break;
      const sentKeys = new Set(payload.entries.map((entry) => entry.key));
      record.remainingEntries = remaining.filter((entry) => !sentKeys.has(entry.key));
      record.pendingDeliveries = [...pending, { deliveryId: payload.deliveryId, entries: payload.entries.map(({ key, stateHash }) => ({ key, stateHash })), encodedBytes }];
      record.summarySent = false;
      persistRepairState();
      session.deliveries.set(payload.deliveryId, { projectId, encodedBytes });
      sendSocket(target.socket, frame);
      idleProjects = 0;
    }
  } finally {
    session.pumping = false;
  }
}

function persistStateEntities(sender: Client, frame: RelayFrame): void {
  const projectId = String(frame.projectId ?? '');
  if (!projectId || !participates(sender.federationId, sender.nodeId, projectId)) throw new Error('unknown_state_project');
  const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
  const deliveryId = String(payload.deliveryId ?? '');
  const wireEntries = Array.isArray(payload.entries) ? payload.entries as StateEntry[] : [];
  if (!deliveryId || wireEntries.length === 0 || wireEntries.length > stateEntityBatchSize) {
    throw new Error('invalid_state_entity_batch');
  }
  const entries = admitStateEntries(projectId, wireEntries);
  const stored = federation(sender.federationId);
  const project = stored.entities[projectId] ?? {};
  const changed: RelayEntity[] = [];
  const accepted: Array<{ key: string; stateHash: string }> = [];
  for (const entry of entries) {
    const joined = joinRelayEntity(project[entry.entityKey], entry.entity);
    accepted.push({ key: entry.entityKey, stateHash: joined.stateHash });
    if (project[entry.entityKey]?.stateHash !== joined.stateHash) changed.push(joined);
    project[entry.entityKey] = joined;
  }
  stored.entities[projectId] = project;
  // WHAT: Advance the project generation only when the accepted batch changes durable relay state.
  // WHY: Duplicate delivery must not renew any node's repair allowance.
  if (changed.length > 0) stored.stateGenerations![projectId] = (stored.stateGenerations![projectId] ?? 0) + 1;
  persistState();
  sendSocket(sender.socket, {
    version: 1,
    type: 'state-relay-ack',
    from: 'relay',
    projectId,
    stateVersion: taskCurrentStateVersion,
    payload: { stateVersion: taskCurrentStateVersion, deliveryId, accepted },
  });
  for (const target of activeClients(sender.federationId)) {
    if (target.nodeId === sender.nodeId || !participates(target.federationId, target.nodeId, projectId)) continue;
    for (const outgoing of stateEntityFrames(projectId, changed)) sendSocket(target.socket, outgoing);
  }
}

function reconcileStateSummary(sender: Client, frame: RelayFrame): void {
  const projectId = String(frame.projectId ?? '');
  if (!projectId || !participates(sender.federationId, sender.nodeId, projectId)) throw new Error('unknown_state_project');
  const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
  const remote = Array.isArray(payload.buckets) ? payload.buckets as StateBucket[] : [];
  const peerRoot = String(payload.root ?? '');
  const peerManifestDigest = assertFederationRepairManifest(peerRoot, remote);
  const stored = federation(sender.federationId);
  const generation = stored.stateGenerations![projectId] ?? 0;
  const session = repairSession(sender.socket);
  const summaryIdentity = `${projectId}\u0000${generation}\u0000${peerRoot}\u0000${peerManifestDigest}`;
  // WHAT: Suppress an identical summary only within the current connection.
  // WHY: Reconnect must retry work whose prior transport delivery was never durably applied.
  if (session.summaries.has(summaryIdentity)) return;
  session.summaries.add(summaryIdentity);
  const local = stateBuckets(sender.federationId, projectId);
  const missing = mismatchedBuckets(local, remote);
  // WHAT: Request relay-missing buckets once for the admitted generation.
  // WHY: Normal reverse convergence remains available without repeating unchanged work.
  if (missing.length > 0) {
    sendSocket(sender.socket, {
      version: 1,
      type: 'state-missing-request',
      from: 'relay',
      projectId,
      stateVersion: taskCurrentStateVersion,
      payload: { stateVersion: taskCurrentStateVersion, buckets: missing },
    });
  }
  const localRoot = hashTaskCurrentRoot(local);
  const summary: RelayFrame = {
    version: 1,
    type: 'state-bucket-summary',
    from: 'relay',
    projectId,
    stateVersion: taskCurrentStateVersion,
    payload: { stateVersion: taskCurrentStateVersion, root: localRoot, buckets: local },
  };
  const broadcastGeneration = stored.stateBroadcastGenerations![projectId] ?? 0;
  // WHAT: Broadcast the terminal root once after durable state changes.
  // WHY: Unchanged peer summaries must not amplify onto healthy participants.
  if (generation > 0 && broadcastGeneration < generation) {
    for (const target of activeClients(sender.federationId)) {
      // WHAT: Deliver the changed root only to project participants.
      // WHY: A repair must not affect unrelated nodes.
      if (participates(target.federationId, target.nodeId, projectId)) sendSocket(target.socket, summary);
    }
    stored.stateBroadcastGenerations![projectId] = generation;
    persistState();
  } else {
    sendSocket(sender.socket, summary);
  }
  // WHAT: Confirm exact equality after answering the admitted summary.
  // WHY: Existing epoch-4 nodes settle relay publication with this frame.
  if (missing.length === 0 && payload.root === localRoot) {
    sendSocket(sender.socket, {
      version: 1,
      type: 'state-converged',
      from: 'relay',
      projectId,
      stateVersion: taskCurrentStateVersion,
      payload: { stateVersion: taskCurrentStateVersion, nodeId: sender.nodeId, root: localRoot },
    });
  }
}

function startStateRepair(sender: Client, frame: RelayFrame): void {
  const projectId = String(frame.projectId ?? '');
  const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
  // WHAT: Reject missing project participation before repair-state mutation.
  // WHY: Only an authenticated participant can own relay-to-node synchronization work.
  if (!projectId || !participates(sender.federationId, sender.nodeId, projectId)) throw new Error('invalid_state_missing_request');
  const buckets = canonicalFederationRepairBuckets(Array.isArray(payload.buckets) ? payload.buckets : []);
  const session = repairSession(sender.socket);
  // WHAT: Preserve bounded legacy service when continuation metadata is absent.
  // WHY: Old epoch-4 nodes must continue to synchronize without enhanced completion authority.
  if (!payload.attemptId || !payload.relayRoot || !payload.receiverRoot) {
    const served = session.buckets.get(projectId) ?? new Set<string>();
    const admitted = buckets.filter((bucket) => !served.has(bucket));
    for (const bucket of admitted) served.add(bucket);
    session.buckets.set(projectId, served);
    // WHAT: Suppress a legacy request when every selected bucket was served on this socket.
    // WHY: Old epoch-4 requests lack durable acknowledgement authority for finer continuation.
    if (admitted.length === 0) return;
    sendStateEntities(sender, projectId, new Set(admitted));
    sendStateSummary(sender, projectId);
    return;
  }
  const attemptId = assertFederationRepairAttempt(payload.attemptId, 'attemptId');
  const relayRoot = assertFederationRepairAttempt(payload.relayRoot, 'relayRoot');
  const receiverRoot = assertFederationRepairAttempt(payload.receiverRoot, 'receiverRoot');
  const attemptSessionIdentity = `attempt:${projectId}:${attemptId}`;
  // WHAT: Suppress an identical enhanced request within the current connection.
  // WHY: Only socket replacement can make sent unacknowledged frames eligible again.
  if (session.summaries.has(attemptSessionIdentity)) return;
  session.summaries.add(attemptSessionIdentity);
  const stored = federation(sender.federationId);
  const currentRelayRoot = hashTaskCurrentRoot(stateBuckets(sender.federationId, projectId));
  // WHAT: Return the current summary when the request names a superseded relay cut.
  // WHY: A repair cannot complete safely from entities belonging to another root.
  if (relayRoot !== currentRelayRoot) {
    sendStateSummary(sender, projectId);
    return;
  }
  const generation = stored.stateGenerations![projectId] ?? 0;
  const recordKey = federationRepairRecordKey(sender.nodeId, projectId);
  const retained = stored.stateRepairRecords![recordKey];
  const sameAttempt = retained?.attemptId === attemptId && retained.generation === generation && retained.relayRoot === relayRoot;
  let record: FederationRepairRecord;
  // WHAT: Continue acknowledged progress when reconnect names the same durable attempt.
  // WHY: Confirmed entries must never be resent after socket replacement or relay restart.
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
      ...createFederationRepairRecord({ nodeId: sender.nodeId, projectId, generation, peerRoot: receiverRoot, peerManifestDigest: relayRoot }),
      attemptId,
      relayRoot,
      receiverRoot,
      requestedBuckets: buckets,
      remainingEntries: repairEntries(sender, projectId, buckets),
      pendingDeliveries: [],
      acknowledgedEntries: {},
      summarySent: false,
    };
  }
  stored.stateRepairRecords![recordKey] = record;
  persistRepairState();
  for (const [deliveryId, delivery] of session.deliveries) {
    // WHAT: Retire only transport deliveries owned by the restarted project attempt.
    // WHY: Reconnecting one project must not release another project's byte credit.
    if (delivery.projectId === projectId) session.deliveries.delete(deliveryId);
  }
  // WHAT: Add this project once to the connection round-robin scheduler.
  // WHY: Duplicate requests share one project window and one global budget.
  if (!session.projects.includes(projectId)) session.projects.unshift(projectId);
  pumpRepairWindow(sender);
}

function acknowledgeStateDelivery(sender: Client, frame: RelayFrame): void {
  const projectId = String(frame.projectId ?? '');
  const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
  // WHAT: Reject missing project participation before acknowledgement mutation.
  // WHY: Only the attempt owner can advance its durable receiver progress.
  if (!projectId || !participates(sender.federationId, sender.nodeId, projectId)) throw new Error('invalid_state_acknowledgement');
  const deliveryId = String(payload.deliveryId ?? '');
  const attemptId = assertFederationRepairAttempt(payload.attemptId, 'attemptId');
  const accepted = Array.isArray(payload.accepted) ? payload.accepted as Array<{ key?: string; stateHash?: string }> : [];
  const stored = federation(sender.federationId);
  const recordKey = federationRepairRecordKey(sender.nodeId, projectId);
  const record = stored.stateRepairRecords![recordKey];
  const delivery = record?.pendingDeliveries?.find((candidate) => candidate.deliveryId === deliveryId);
  // WHAT: Reject acknowledgements outside the exact active attempt and delivery.
  // WHY: Only correlated durable application may advance the streaming window.
  if (!record || record.attemptId !== attemptId || !delivery) throw new Error('invalid_state_acknowledgement');
  const acceptedMap = new Map(accepted.map((entry) => [String(entry.key ?? ''), String(entry.stateHash ?? '')]));
  // WHAT: Require each submitted key and hash to be acknowledged exactly once.
  // WHY: Partial acknowledgement cannot prove omitted entries reached durable state.
  if (acceptedMap.size !== delivery.entries.length || delivery.entries.some((entry) => acceptedMap.get(entry.key) !== entry.stateHash)) {
    throw new Error('invalid_state_acknowledgement');
  }
  record.acknowledgedEntries = { ...(record.acknowledgedEntries ?? {}), ...Object.fromEntries(delivery.entries.map((entry) => [entry.key, entry.stateHash])) };
  record.pendingDeliveries = (record.pendingDeliveries ?? []).filter((candidate) => candidate.deliveryId !== deliveryId);
  persistRepairState();
  const session = repairSession(sender.socket);
  session.deliveries.delete(deliveryId);
  // WHAT: Return the acknowledged project to the round-robin queue.
  // WHY: Each durable acknowledgement must immediately admit its next bounded batch.
  if (!session.projects.includes(projectId)) session.projects.push(projectId);
  pumpRepairWindow(sender);
}

function completeStateRepair(sender: Client, frame: RelayFrame): void {
  const projectId = String(frame.projectId ?? '');
  const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
  // WHAT: Reject missing project participation before convergence mutation.
  // WHY: Only the receiver owning the repair attempt can complete it.
  if (!projectId || !participates(sender.federationId, sender.nodeId, projectId)) throw new Error('invalid_state_convergence');
  // WHAT: Ignore legacy convergence frames without enhanced attempt authority.
  // WHY: Old epoch-4 nodes remain compatible but cannot finalize durable continuation state.
  if (!payload.attemptId) return;
  const attemptId = assertFederationRepairAttempt(payload.attemptId, 'attemptId');
  const root = assertFederationRepairAttempt(payload.root, 'relayRoot');
  const stored = federation(sender.federationId);
  const recordKey = federationRepairRecordKey(sender.nodeId, projectId);
  const record = stored.stateRepairRecords![recordKey];
  const currentRoot = hashTaskCurrentRoot(stateBuckets(sender.federationId, projectId));
  // WHAT: Complete only an empty attempt whose receiver confirms the current relay root.
  // WHY: Sent, pending, stale-cut, and unequal-root attempts must remain retryable.
  if (!record || record.attemptId !== attemptId || record.remainingEntries?.length || record.pendingDeliveries?.length || root !== currentRoot) {
    throw new Error('invalid_state_convergence');
  }
  record.servedBuckets = [...(record.requestedBuckets ?? [])];
  record.completedAt = new Date().toISOString();
  persistRepairState();
  const session = repairSession(sender.socket);
  session.projects = session.projects.filter((candidate) => candidate !== projectId);
}

function handleFrame(sender: Client, text: string): void {
  if (Buffer.byteLength(text) > maximumFrameBytes) throw new Error('federation_body_limit');
  const frame = parseFrame(text);
  if (frame.type === 'manifest') {
    assertStateManifest(frame);
    const stored = federation(sender.federationId);
    stored.manifests[sender.nodeId] = Array.isArray(frame.projects) ? frame.projects : [];
    stored.labels[sender.nodeId] = String(frame.nodeLabel || sender.nodeId).slice(0, 120);
    persistState();
    publishCatalog(sender.federationId);
    for (const project of frame.projects ?? []) sendStateSummary(sender, String(project.id ?? ''));
    return;
  }
  if (frame.type === 'state-subscribe') {
    if (frame.stateVersion !== taskCurrentStateVersion) throw new Error('incompatible_state_protocol');
    const projectId = String(frame.projectId ?? '');
    if (!projectId) throw new Error('unknown_state_project');
    const values = subscriptions.get(clientKey(sender.federationId, sender.nodeId)) ?? new Set<string>();
    values.add(projectId);
    subscriptions.set(clientKey(sender.federationId, sender.nodeId), values);
    sendStateSummary(sender, projectId);
    return;
  }
  if (frame.type === 'content-change') {
    for (const target of activeClients(sender.federationId)) {
      if (target.nodeId !== sender.nodeId) sendSocket(target.socket, { version: 1, type: 'content-change', from: sender.nodeId });
    }
    return;
  }
  if (priorityStateFrameTypes.has(frame.type)) {
    if (Buffer.byteLength(text) > maximumStateFrameBytes) throw new Error('state_frame_too_large');
    if (frame.stateVersion !== taskCurrentStateVersion) throw new Error('incompatible_state_protocol');
    if (!frame.to) {
      if (frame.type === 'state-entity-batch') persistStateEntities(sender, frame);
      else if (frame.type === 'state-bucket-summary') reconcileStateSummary(sender, frame);
      // WHAT: Start bounded repair from the receiver's canonical missing selection.
      // WHY: Termux must mirror Worker continuation and flow-control authority.
      else if (frame.type === 'state-missing-request') startStateRepair(sender, frame);
      // WHAT: Advance enhanced repair only from durable receiver acknowledgement.
      // WHY: Socket send cannot release Termux relay flow-control credit.
      else if (frame.type === 'state-relay-ack' || frame.type === 'state-ack') acknowledgeStateDelivery(sender, frame);
      // WHAT: Complete an emptied attempt only from equal-root convergence.
      // WHY: Pending or unequal attempts remain retryable across relay restart.
      else if (frame.type === 'state-converged') completeStateRepair(sender, frame);
      else if (frame.type === 'state-execution-observation') {
        const projectId = String(frame.projectId ?? '');
        for (const target of activeClients(sender.federationId)) {
          if (target.nodeId !== sender.nodeId && participates(target.federationId, target.nodeId, projectId)) {
            sendSocket(target.socket, { ...frame, from: sender.nodeId, to: undefined });
          }
        }
      } else {
        throw new Error('unsupported_relay_state_frame');
      }
      return;
    }
    if (!client(sender.federationId, frame.to)) throw new Error('owner_offline');
    send(sender.federationId, frame.to, { ...frame, from: sender.nodeId, to: undefined });
    return;
  }
  const requestId = String(frame.requestId ?? '');
  if (frame.type === 'request-open') {
    if (!requestId || !frame.to || !client(sender.federationId, frame.to)) throw new Error('owner_offline');
    const active = [...streams.entries()].filter(([key, stream]) => key.startsWith(`${sender.federationId}\0`)
      && (stream.requester === sender.nodeId || stream.owner === sender.nodeId)).length;
    const key = streamKey(sender.federationId, requestId);
    if (active >= maximumStreamsPerNode || streams.has(key)) throw new Error('federation_capacity');
    streams.set(key, { requester: sender.nodeId, owner: frame.to, requestCredit: creditWindowBytes, responseCredit: creditWindowBytes });
    send(sender.federationId, frame.to, { ...frame, from: sender.nodeId, to: undefined, headers: frame.headers ?? {} });
    return;
  }
  if (!requestId) throw new Error('invalid_frame');
  const key = streamKey(sender.federationId, requestId);
  const stream = streams.get(key);
  if (!stream) throw new Error('unknown_request');
  if (frame.type === 'credit') {
    const direction = frame.direction;
    const bytes = Number(frame.bytes ?? 0);
    const receiver = direction === 'request' ? stream.owner : stream.requester;
    const destination = direction === 'request' ? stream.requester : stream.owner;
    if ((direction !== 'request' && direction !== 'response') || bytes <= 0 || bytes > creditWindowBytes || sender.nodeId !== receiver) {
      throw new Error('invalid_credit');
    }
    const creditKey = direction === 'request' ? 'requestCredit' : 'responseCredit';
    stream[creditKey] = Math.min(creditWindowBytes, stream[creditKey] + bytes);
    send(sender.federationId, destination, frame);
    return;
  }
  if (frame.type === 'request-chunk' || frame.type === 'response-chunk') {
    const direction = frame.type === 'request-chunk' ? 'request' : 'response';
    const expected = direction === 'request' ? stream.requester : stream.owner;
    const destination = direction === 'request' ? stream.owner : stream.requester;
    const bytes = Buffer.from(String(frame.data ?? ''), 'base64').byteLength;
    const creditKey = direction === 'request' ? 'requestCredit' : 'responseCredit';
    if (sender.nodeId !== expected || bytes > stream[creditKey]) throw new Error('federation_flow_control');
    stream[creditKey] -= bytes;
    send(sender.federationId, destination, frame);
    return;
  }
  const destination = sender.nodeId === stream.requester ? stream.owner : stream.requester;
  send(sender.federationId, destination, frame);
  if (frame.type === 'response-end' || frame.type === 'response-error' || frame.type === 'cancel') streams.delete(key);
}

const webSockets = new WebSocketServer({ noServer: true });
webSockets.on('connection', (socket: WebSocket, request: IncomingMessage, connected: Client) => {
  const key = clientKey(connected.federationId, connected.nodeId);
  clients.get(key)?.socket.close(4001, 'replaced');
  clients.set(key, connected);
  socket.on('message', (message) => {
    try {
      handleFrame(connected, message.toString());
    } catch (error) {
      const code = error instanceof Error ? error.message : 'invalid_frame';
      try { sendSocket(socket, { version: 1, type: 'response-error', code, message: code }); } catch { /* Socket settlement owns failure. */ }
    }
  });
  socket.on('close', () => {
    if (clients.get(key)?.socket === socket) clients.delete(key);
    subscriptions.delete(key);
    publishCatalog(connected.federationId);
  });
  publishCatalog(connected.federationId);
});

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`);
  if (request.method === 'GET' && url.pathname === '/health') {
    json(response, 200, {
      ok: true,
      status: 'ready',
      service: 'decision-os-federation-relay',
      observedAt: new Date().toISOString(),
      releaseSha,
      deliveryProtocol: 1,
      protocolVersion,
      stateProtocol,
      stateSchema,
      baselineEpoch: stateBaselineEpoch,
      environment: 'dev',
      workerName: 'decision-os-federation-relay-dev',
      durableObjectNamespace: 'decision-os-federations-dev',
      runtime: 'termux-node',
    });
    return;
  }
  const provision = url.pathname.match(/^\/admin\/federations\/([a-zA-Z0-9_-]+)\/nodes\/([a-zA-Z0-9_-]+)$/);
  if (request.method === 'POST' && provision) {
    if (!sameSecret(bearer(request), administratorSecret)) {
      json(response, 401, { ok: false, error: 'federation_authentication' });
      return;
    }
    const credential = randomBytes(48).toString('base64url');
    federation(provision[1]).credentials[provision[2]] = digest(credential);
    persistState();
    json(response, 201, { ok: true, nodeId: provision[2], credential });
    return;
  }
  json(response, 404, { ok: false, error: 'not_found' });
});

server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`);
    const connect = url.pathname.match(/^\/connect\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
    if (!connect) throw new Error('not_found');
    const expected = federation(connect[1]).credentials[connect[2]];
    if (!expected || !sameSecret(digest(bearer(request)), expected)) throw new Error('federation_authentication');
    webSockets.handleUpgrade(request, socket, head, (webSocket) => {
      const connected = { federationId: connect[1], nodeId: connect[2], socket: webSocket };
      webSockets.emit('connection', webSocket, request, connected);
    });
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
  }
});

server.listen(port, host, () => {
  process.stdout.write(`${JSON.stringify({ service: 'decision-os-federation-relay', runtime: 'termux-node', host, port, releaseSha, stateFile })}\n`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    for (const connected of clients.values()) connected.socket.close(1001, 'shutdown');
    server.close(() => process.exit(0));
  });
}
