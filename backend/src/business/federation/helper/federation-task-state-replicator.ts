/**
 * WHAT: Delivers correlated, byte-bounded epoch-3 entity state and closes root repair loops.
 * WHY: Dirty state clears only after exact relay acknowledgement and synchronization requires equal roots.
 */
import { randomUUID } from 'node:crypto';
import { taskCurrentEntityKey } from '../../../../../shared/task-current-state-core.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import { taskCurrentStateVersion, type TaskCurrentBucket, type TaskCurrentEntity, type TaskStateDelta } from '../../task-state/helper/task-current-state-types.js';
import type { FederationStateFrame } from './federation-node-connector.js';

type Publisher = (peerId: string, frame: Omit<FederationStateFrame, 'from'>) => boolean;
type StateEnvelope = { key: string; stateHash: string; entity: TaskCurrentEntity };
type PendingDelivery = { projectId: string; hashes: Map<string, string> };
const maximumBatchEntities = 128;
const maximumStateFrameBytes = 512 * 1024;
const encoder = new TextEncoder();

function bucketMap(values: TaskCurrentBucket[]): Map<string, TaskCurrentBucket> {
  return new Map(values.map((entry) => [entry.bucket, entry]));
}

function mismatchedBuckets(local: TaskCurrentBucket[], remote: TaskCurrentBucket[]): string[] {
  const left = bucketMap(local);
  const right = bucketMap(remote);
  return [...new Set([...left.keys(), ...right.keys()])].filter((bucket) => {
    const localEntry = left.get(bucket);
    const remoteEntry = right.get(bucket);
    return localEntry?.count !== remoteEntry?.count || localEntry?.checksum !== remoteEntry?.checksum;
  }).sort();
}

function envelopes(entities: TaskCurrentEntity[]): StateEnvelope[] {
  return entities.map((entity) => ({ key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity }));
}

function boundedFrames(projectId: string, entities: TaskCurrentEntity[]): Array<{ deliveryId: string; entries: StateEnvelope[] }> {
  const frames: Array<{ deliveryId: string; entries: StateEnvelope[] }> = [];
  let entries: StateEnvelope[] = [];
  for (const entry of envelopes(entities)) {
    const candidate = [...entries, entry];
    const deliveryId = randomUUID();
    const bytes = encoder.encode(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: taskCurrentStateVersion, projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId, entries: candidate } })).byteLength;
    if (entries.length > 0 && (candidate.length > maximumBatchEntities || bytes > maximumStateFrameBytes)) {
      frames.push({ deliveryId: randomUUID(), entries });
      entries = [entry];
    } else {
      entries = candidate;
    }
  }
  if (entries.length > 0) frames.push({ deliveryId: randomUUID(), entries });
  for (const frame of frames) {
    const bytes = encoder.encode(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: taskCurrentStateVersion, projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: frame.deliveryId, entries: frame.entries } })).byteLength;
    if (bytes > maximumStateFrameBytes) throw new Error('state_frame_too_large');
  }
  return frames;
}

export function createFederationTaskStateReplicator(input: {
  stores: () => Map<string, TaskCurrentStateStore>;
  storeFor?: (projectId: string, ownerNodeId: string) => TaskCurrentStateStore | null;
  publish: Publisher;
  onProjectionChange?: (input: { projectId: string; from: string; delta: TaskStateDelta }) => void;
}) {
  const convergence = new Map<string, { projectId: string; converged: boolean; lastRepairAt: string; missingBuckets: string[]; root: string }>();
  const runtimeDirty = new Map<string, Map<string, TaskCurrentEntity>>();
  const pendingDeliveries = new Map<string, PendingDelivery>();

  const dirtyFor = (projectId: string): Map<string, TaskCurrentEntity> => {
    const dirty = runtimeDirty.get(projectId) ?? new Map<string, TaskCurrentEntity>();
    runtimeDirty.set(projectId, dirty);
    return dirty;
  };

  const publishEntities = (peerId: string, projectId: string, entities: TaskCurrentEntity[]): boolean => {
    let sent = true;
    for (const frame of boundedFrames(projectId, entities)) {
      const published = input.publish(peerId, { type: 'state-entity-batch', projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: frame.deliveryId, entries: frame.entries } });
      sent = published && sent;
      if (published && peerId === 'relay') pendingDeliveries.set(frame.deliveryId, { projectId, hashes: new Map(frame.entries.map((entry) => [entry.key, entry.stateHash])) });
    }
    return sent;
  };

  const advertise = (peerId: string, projectId: string, store: TaskCurrentStateStore): void => {
    input.publish(peerId, { type: 'state-bucket-summary', projectId, payload: { stateVersion: taskCurrentStateVersion, root: store.rootHash(), buckets: store.bucketManifest() } });
  };

  const publishDelta = (delta: TaskStateDelta): void => {
    if (delta.entities.length === 0) return;
    const dirty = dirtyFor(delta.projectId);
    for (const entity of delta.entities) dirty.set(taskCurrentEntityKey(entity), entity);
    publishEntities('relay', delta.projectId, [...dirty.values()]);
  };

  const reconcileRelay = (): void => {
    for (const [projectId, store] of input.stores()) {
      const dirty = runtimeDirty.get(projectId);
      if (dirty?.size) publishEntities('relay', projectId, [...dirty.values()]);
      advertise('relay', projectId, store);
    }
  };

  const reconcileProject = (peerId: string, projectId: string): void => {
    input.publish(peerId, { type: peerId === 'relay' ? 'state-subscribe' : 'state-summary-request', projectId, payload: { stateVersion: taskCurrentStateVersion } });
  };

  const handleFrame = async (frame: FederationStateFrame): Promise<void> => {
    if (!frame.from) return;
    const store = input.stores().get(frame.projectId) ?? input.storeFor?.(frame.projectId, frame.from);
    if (!store) return;
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};
    if (Number(payload.stateVersion ?? taskCurrentStateVersion) !== taskCurrentStateVersion) throw new Error('incompatible_state_protocol');

    if (frame.type === 'state-summary-request') {
      advertise(frame.from, frame.projectId, store);
      return;
    }

    if (frame.type === 'state-entity-batch') {
      const entries = Array.isArray(payload.entries) ? payload.entries as StateEnvelope[] : [];
      for (const entry of entries) if (entry.key !== taskCurrentEntityKey(entry.entity) || entry.stateHash !== entry.entity.stateHash) throw new Error('invalid_state_entity_envelope');
      const result = await store.merge({ version: taskCurrentStateVersion, projectId: frame.projectId, entities: entries.map((entry) => entry.entity) });
      const accepted = entries.map((entry) => ({ key: entry.key, stateHash: store.entity(entry.entity.entityType, entry.entity.entityId)?.stateHash ?? '' }));
      input.publish(frame.from, { type: frame.from === 'relay' ? 'state-relay-ack' : 'state-ack', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: payload.deliveryId, accepted, root: store.rootHash() } });
      if (result.changed) input.onProjectionChange?.({ projectId: frame.projectId, from: frame.from, delta: result.delta });
      advertise(frame.from, frame.projectId, store);
      return;
    }

    if (frame.type === 'state-bucket-summary') {
      const remote = Array.isArray(payload.buckets) ? payload.buckets as TaskCurrentBucket[] : [];
      const missing = mismatchedBuckets(store.bucketManifest(), remote);
      const root = store.rootHash();
      const converged = missing.length === 0 && payload.root === root;
      convergence.set(`${frame.from}\u0000${frame.projectId}`, { projectId: frame.projectId, converged, lastRepairAt: new Date().toISOString(), missingBuckets: missing, root });
      if (missing.length > 0) input.publish(frame.from, { type: 'state-missing-request', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, buckets: missing } });
      else if (converged) input.publish(frame.from, { type: 'state-converged', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, root } });
      else advertise(frame.from, frame.projectId, store);
      return;
    }

    if (frame.type === 'state-missing-request') {
      const buckets = Array.isArray(payload.buckets) ? payload.buckets.map(String) : [];
      publishEntities(frame.from, frame.projectId, store.entitiesForBuckets(buckets));
      return;
    }

    if (frame.type === 'state-relay-ack') {
      const deliveryId = String(payload.deliveryId ?? '');
      const delivery = pendingDeliveries.get(deliveryId);
      if (!delivery || delivery.projectId !== frame.projectId) return;
      const accepted = Array.isArray(payload.accepted) ? payload.accepted as Array<{ key?: string; stateHash?: string }> : [];
      const dirty = runtimeDirty.get(frame.projectId);
      for (const acknowledgement of accepted) {
        const key = String(acknowledgement.key ?? '');
        const stateHash = String(acknowledgement.stateHash ?? '');
        if (delivery.hashes.get(key) === stateHash && dirty?.get(key)?.stateHash === stateHash) dirty.delete(key);
      }
      pendingDeliveries.delete(deliveryId);
      if (dirty?.size === 0) runtimeDirty.delete(frame.projectId);
    }
  };

  return {
    publishDelta,
    reconcileRelay,
    reconcileProject,
    handleFrame,
    diagnostics: () => ({
      convergence: [...convergence].map(([key, value]) => ({ peerId: key.split('\u0000')[0], ...value })),
      runtimeDirty: [...runtimeDirty].flatMap(([projectId, entities]) => [...entities].map(([entityKey, entity]) => ({ projectId, entityKey, stateHash: entity.stateHash }))),
      pendingDeliveryIds: [...pendingDeliveries.keys()],
    }),
  };
}
