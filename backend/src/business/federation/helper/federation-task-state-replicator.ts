/**
 * WHAT: Replicates causal current entity state through the existing federation frame family.
 * WHY: Live delivery and reconnect repair must transfer current divergent lanes without historical replay.
 */
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import { taskCurrentStateVersion, type TaskCurrentBucket, type TaskCurrentEntity, type TaskStateDelta } from '../../task-state/helper/task-current-state-types.js';
import type { FederationStateFrame } from './federation-node-connector.js';

type Publisher = (peerId: string, frame: Omit<FederationStateFrame, 'from'>) => boolean;
const maximumBatchEntities = 128;

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

export function createFederationTaskStateReplicator(input: {
  stores: () => Map<string, TaskCurrentStateStore>;
  storeFor?: (projectId: string, ownerNodeId: string) => TaskCurrentStateStore | null;
  publish: Publisher;
  onProjectionChange?: (input: { projectId: string; from: string; delta: TaskStateDelta }) => void;
}) {
  const convergence = new Map<string, { projectId: string; converged: boolean; lastRepairAt: string; missingBuckets: string[] }>();
  const runtimeRetry = new Map<string, TaskStateDelta>();

  const publishEntities = (peerId: string, projectId: string, entities: TaskCurrentEntity[]): boolean => {
    let sent = true;
    for (let index = 0; index < entities.length; index += maximumBatchEntities) {
      sent = input.publish(peerId, { type: 'state-entity-batch', projectId, payload: { stateVersion: taskCurrentStateVersion, entities: entities.slice(index, index + maximumBatchEntities) } }) && sent;
    }
    return sent;
  };

  const advertise = (peerId: string, projectId: string, store: TaskCurrentStateStore): void => {
    input.publish(peerId, { type: 'state-bucket-summary', projectId, payload: { stateVersion: taskCurrentStateVersion, root: store.rootHash(), buckets: store.bucketManifest() } });
  };

  const publishDelta = (delta: TaskStateDelta): void => {
    if (delta.entities.length === 0) return;
    const key = delta.projectId;
    if (!publishEntities('relay', delta.projectId, delta.entities)) runtimeRetry.set(key, delta);
  };

  const reconcileRelay = (): void => {
    for (const [projectId, store] of input.stores()) {
      const retry = runtimeRetry.get(projectId);
      if (retry && publishEntities('relay', projectId, retry.entities)) runtimeRetry.delete(projectId);
      advertise('relay', projectId, store);
    }
  };

  const reconcileProject = (peerId: string, projectId: string): void => {
    input.publish(peerId, { type: 'state-summary-request', projectId, payload: { stateVersion: taskCurrentStateVersion } });
  };

  const handleFrame = async (frame: FederationStateFrame): Promise<void> => {
    if (!frame.from) return;
    const store = input.stores().get(frame.projectId) ?? input.storeFor?.(frame.projectId, frame.from);
    if (!store) return;
    const payload = frame.payload && typeof frame.payload === 'object' ? frame.payload as Record<string, unknown> : {};

    if (frame.type === 'state-summary-request') {
      advertise(frame.from, frame.projectId, store);
      return;
    }

    if (frame.type === 'state-entity-batch') {
      const entities = Array.isArray(payload.entities) ? payload.entities as TaskCurrentEntity[] : [];
      const result = await store.merge({ version: taskCurrentStateVersion, projectId: frame.projectId, entities });
      input.publish(frame.from, { type: frame.from === 'relay' ? 'state-relay-ack' : 'state-ack', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, root: store.rootHash() } });
      if (result.changed) input.onProjectionChange?.({ projectId: frame.projectId, from: frame.from, delta: result.delta });
      return;
    }

    if (frame.type === 'state-bucket-summary') {
      const remote = Array.isArray(payload.buckets) ? payload.buckets as TaskCurrentBucket[] : [];
      const missing = mismatchedBuckets(store.bucketManifest(), remote);
      convergence.set(frame.from, { projectId: frame.projectId, converged: missing.length === 0, lastRepairAt: new Date().toISOString(), missingBuckets: missing });
      if (missing.length > 0) input.publish(frame.from, { type: 'state-missing-request', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, buckets: missing } });
      else input.publish(frame.from, { type: 'state-converged', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, root: store.rootHash() } });
      return;
    }

    if (frame.type === 'state-missing-request') {
      const buckets = Array.isArray(payload.buckets) ? payload.buckets.map(String) : [];
      publishEntities(frame.from, frame.projectId, store.entitiesForBuckets(buckets));
      return;
    }

    if (frame.type === 'state-relay-ack') {
      runtimeRetry.delete(frame.projectId);
      return;
    }
  };

  return {
    publishDelta,
    reconcileRelay,
    reconcileProject,
    handleFrame,
    diagnostics: () => ({
      convergence: [...convergence].map(([peerId, value]) => ({ peerId, ...value })),
      runtimeRetryProjects: [...runtimeRetry.keys()],
    }),
  };
}
