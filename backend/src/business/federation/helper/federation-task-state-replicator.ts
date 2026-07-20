import { randomUUID } from 'node:crypto';
import type { FederationStateFrame } from './federation-node-connector.js';
import { assertTaskFieldEvent, sha256 } from '../../task-state/helper/task-event-codec.js';
import type { TaskEventStore } from '../../task-state/helper/task-event-store.js';
import type { TaskBucketManifestEntry, TaskFieldEvent, TaskStateSnapshot } from '../../task-state/helper/task-event-types.js';

type Publisher = (nodeId: string, frame: Omit<FederationStateFrame, 'from'>) => boolean;
type SnapshotTransfer = { projectId: string; from: string; checksum: string; chunks: string[]; total: number };

const maximumBatchEvents = 128;
const snapshotChunkBytes = 384 * 1024;

function bucketsEqual(left: TaskBucketManifestEntry[], right: TaskBucketManifestEntry[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mismatchedBuckets(local: TaskBucketManifestEntry[], remote: TaskBucketManifestEntry[]): string[] {
  const localByName = new Map(local.map((entry) => [entry.bucket, entry]));
  return remote.filter((entry) => {
    const value = localByName.get(entry.bucket);
    return !value || value.count !== entry.count || value.checksum !== entry.checksum;
  }).map((entry) => entry.bucket);
}

export function createFederationTaskStateReplicator(input: {
  nodeId: string;
  stores: () => Map<string, TaskEventStore>;
  storeFor?: (projectId: string, ownerNodeId: string) => TaskEventStore | null;
  peers: () => Array<{ nodeId: string; online: boolean }>;
  publish: Publisher;
  onProjectionChange?: (input: { projectId: string; from: string }) => void;
}) {
  const transfers = new Map<string, SnapshotTransfer>();
  const awaitingSnapshots = new Set<string>();
  const publishedRelaySnapshotForBuckets = new Map<string, string>();
  const convergence = new Map<string, { projectId: string; converged: boolean; lastRepairAt: string; missingBuckets: string[] }>();

  const publishBatch = (peerId: string, projectId: string, events: TaskFieldEvent[]): boolean => {
    let sent = true;
    for (let index = 0; index < events.length; index += maximumBatchEvents) {
      sent = input.publish(peerId, { type: 'state-event-batch', projectId, payload: { events: events.slice(index, index + maximumBatchEvents) } }) && sent;
    }
    return sent;
  };

  const advertise = (peerId: string, projectId: string, store: TaskEventStore): void => {
    input.publish(peerId, { type: 'state-snapshot-manifest', projectId, payload: { manifests: store.snapshotManifests() } });
    input.publish(peerId, { type: 'state-bucket-summary', projectId, payload: { buckets: store.bucketManifest() } });
  };

  const publishEvent = (event: TaskFieldEvent): void => {
    const store = input.stores().get(event.projectId);
    if (!store) return;
    store.markPending('relay', event.eventId);
    publishBatch('relay', event.projectId, [event]);
  };

  const reconcileRelay = (): void => {
    for (const [projectId, store] of input.stores()) {
      for (const peer of input.peers()) {
        const legacyPending = store.pendingFor(peer.nodeId);
        if (legacyPending.length > 0) store.acknowledge(peer.nodeId, legacyPending.map((event) => event.eventId));
      }
      const pending = store.pendingFor('relay');
      if (pending.length > 0) publishBatch('relay', projectId, pending);
      input.publish('relay', { type: 'state-bucket-summary', projectId, payload: { buckets: store.bucketManifest() } });
    }
  };

  const reconcilePeer = (_peerId: string): void => reconcileRelay();

  const sendSnapshot = (peerId: string, projectId: string, snapshot: TaskStateSnapshot): void => {
    const bytes = Buffer.from(JSON.stringify(snapshot));
    const transferId = randomUUID();
    const total = Math.ceil(bytes.byteLength / snapshotChunkBytes);
    for (let index = 0; index < total; index += 1) {
      input.publish(peerId, {
        type: 'state-snapshot-chunk',
        projectId,
        payload: { transferId, index, total, checksum: sha256(bytes), data: bytes.subarray(index * snapshotChunkBytes, (index + 1) * snapshotChunkBytes).toString('base64') },
      });
    }
    input.publish(peerId, { type: 'state-snapshot-end', projectId, payload: { transferId, total, checksum: sha256(bytes) } });
  };

  const handleFrame = async (frame: FederationStateFrame): Promise<void> => {
    const targetsLocalState = frame.type === 'state-relay-ack'
      || frame.type === 'state-ack'
      || frame.type === 'state-missing-request'
      || frame.type === 'state-snapshot-request';
    const store = targetsLocalState
      ? input.stores().get(frame.projectId)
      : input.storeFor?.(frame.projectId, frame.from) ?? input.stores().get(frame.projectId);
    if (!store || !frame.from) return;
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    if (frame.type === 'state-relay-ack') {
      store.acknowledge('relay', Array.isArray(payload.eventIds) ? payload.eventIds.map(String) : []);
      return;
    }
    if (frame.type === 'state-event-batch') {
      const accepted: string[] = [];
      for (const raw of Array.isArray(payload.events) ? payload.events : []) {
        const event = raw as TaskFieldEvent;
        assertTaskFieldEvent(event);
        try { store.append(event); }
        catch (error) {
          if (error instanceof Error && error.message === 'task_event_requires_snapshot_refresh') {
            awaitingSnapshots.add(`${frame.from}\u0000${frame.projectId}`);
            input.publish(frame.from, { type: 'state-snapshot-request', projectId: frame.projectId, payload: { snapshotId: '' } });
            return;
          }
          throw error;
        }
        accepted.push(event.eventId);
      }
      if (accepted.length > 0) input.publish(frame.from, { type: 'state-ack', projectId: frame.projectId, payload: { eventIds: accepted } });
      if (accepted.length > 0) input.onProjectionChange?.({ projectId: frame.projectId, from: frame.from });
      return;
    }
    if (frame.type === 'state-ack') {
      store.acknowledge(frame.from, Array.isArray(payload.eventIds) ? payload.eventIds.map(String) : []);
      return;
    }
    if (frame.type === 'state-bucket-summary') {
      if (awaitingSnapshots.has(`${frame.from}\u0000${frame.projectId}`)) return;
      const remote = Array.isArray(payload.buckets) ? payload.buckets as TaskBucketManifestEntry[] : [];
      const local = store.bucketManifest();
      const missing = mismatchedBuckets(local, remote);
      convergence.set(frame.from, { projectId: frame.projectId, converged: missing.length === 0 && bucketsEqual(local, remote), lastRepairAt: new Date().toISOString(), missingBuckets: missing });
      if (missing.length > 0) input.publish(frame.from, { type: 'state-missing-request', projectId: frame.projectId, payload: { buckets: missing } });
      else if (bucketsEqual(local, remote)) input.publish(frame.from, { type: 'state-converged', projectId: frame.projectId, payload: { buckets: local } });
      return;
    }
    if (frame.type === 'state-missing-request') {
      const requested = new Set(Array.isArray(payload.buckets) ? payload.buckets.map(String) : []);
      const events = store.events().filter((event) => requested.has(event.emittedAt.slice(0, 13)));
      publishBatch(frame.from, frame.projectId, events);
      return;
    }
    if (frame.type === 'state-snapshot-manifest') {
      const manifests = Array.isArray(payload.manifests) ? payload.manifests as Array<Record<string, unknown>> : [];
      const selected = manifests.filter((manifest) => Number(manifest.reducerVersion) === 1).sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))).at(-1);
      const local = store.snapshots().at(-1)?.manifest;
      if (selected && (String(selected.snapshotId ?? '') !== local?.snapshotId || String(selected.projectionChecksum ?? '') !== local?.projectionChecksum)) {
        awaitingSnapshots.add(`${frame.from}\u0000${frame.projectId}`);
        input.publish(frame.from, { type: 'state-snapshot-request', projectId: frame.projectId, payload: { snapshotId: selected.snapshotId } });
      }
      return;
    }
    if (frame.type === 'state-snapshot-request') {
      const snapshotId = String(payload.snapshotId ?? '');
      if (!snapshotId) {
        advertise(frame.from, frame.projectId, store);
        return;
      }
      const snapshot = store.snapshots().find((entry) => entry.manifest.snapshotId === snapshotId);
      if (snapshot) sendSnapshot(frame.from, frame.projectId, snapshot);
      return;
    }
    if (frame.type === 'state-snapshot-chunk') {
      const transferId = String(payload.transferId ?? '');
      const total = Number(payload.total ?? 0);
      const index = Number(payload.index ?? -1);
      if (!transferId || total < 1 || index < 0 || index >= total || typeof payload.data !== 'string') return;
      const transfer = transfers.get(transferId) ?? { projectId: frame.projectId, from: frame.from, checksum: String(payload.checksum ?? ''), chunks: Array(total).fill(''), total };
      transfer.chunks[index] = payload.data;
      transfers.set(transferId, transfer);
      return;
    }
    if (frame.type === 'state-snapshot-end') {
      const transferId = String(payload.transferId ?? '');
      const transfer = transfers.get(transferId);
      if (!transfer || transfer.chunks.some((chunk) => !chunk)) return;
      const bytes = Buffer.concat(transfer.chunks.map((chunk) => Buffer.from(chunk, 'base64')));
      if (sha256(bytes) !== transfer.checksum || transfer.checksum !== String(payload.checksum ?? '')) throw new Error('invalid_transferred_task_snapshot');
      store.installSnapshot(JSON.parse(bytes.toString('utf8')) as TaskStateSnapshot);
      awaitingSnapshots.delete(`${frame.from}\u0000${frame.projectId}`);
      input.onProjectionChange?.({ projectId: frame.projectId, from: frame.from });
      transfers.delete(transferId);
      input.publish(frame.from, { type: 'state-ack', projectId: frame.projectId, payload: { eventIds: store.projection().appliedEventIds } });
      input.publish(frame.from, { type: 'state-bucket-summary', projectId: frame.projectId, payload: { buckets: store.bucketManifest() } });
      return;
    }
    if (frame.type === 'state-converged') {
      convergence.set(frame.from, { projectId: frame.projectId, converged: true, lastRepairAt: new Date().toISOString(), missingBuckets: [] });
      if (frame.from === 'relay') {
        const bucketSignature = JSON.stringify(store.bucketManifest());
        if (publishedRelaySnapshotForBuckets.get(frame.projectId) !== bucketSignature) {
          const snapshot = store.createSnapshot();
          publishedRelaySnapshotForBuckets.set(frame.projectId, bucketSignature);
          sendSnapshot('relay', frame.projectId, snapshot);
        }
      }
    }
  };

  return {
    publishEvent,
    reconcileRelay,
    reconcilePeer,
    handleFrame,
    diagnostics: () => ({
      pendingAcknowledgements: [...input.stores()].flatMap(([projectId, store]) => [
        { projectId, peerId: 'relay', count: store.pendingFor('relay').length },
      ]),
      convergence: [...convergence].map(([peerId, state]) => ({ peerId, ...state })),
      activeSnapshotTransfers: transfers.size,
      awaitingSnapshots: awaitingSnapshots.size,
    }),
  };
}

export type FederationTaskStateReplicator = ReturnType<typeof createFederationTaskStateReplicator>;
