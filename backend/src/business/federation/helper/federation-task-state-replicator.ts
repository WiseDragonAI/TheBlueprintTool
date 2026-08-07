/**
 * WHAT: Delivers correlated, byte-bounded epoch-4 entity state and closes root repair loops.
 * WHY: Dirty state clears only after exact relay acknowledgement and synchronization requires equal roots.
 */
import { randomUUID } from 'node:crypto';
import { assertFederationRepairManifest, canonicalFederationRepairBuckets } from '../../../../../shared/federation-repair-guard.js';
import { federationMaximumStateFrameBytes, federationStateEntityBatchSize } from '../../../../../shared/federation-state-transport.js';
import { taskCurrentEntityKey } from '../../../../../shared/task-current-state-core.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import { taskCurrentStateVersion, type TaskCurrentBucket, type TaskCurrentEntity, type TaskStateDelta } from '../../task-state/helper/task-current-state-types.js';
import type { FederationStateFrame } from './federation-node-connector.js';

type Publisher = (peerId: string, frame: Omit<FederationStateFrame, 'from'>) => boolean;
type StateEnvelope = { key: string; stateHash: string; entity: TaskCurrentEntity };
type PendingDelivery = { projectId: string; hashes: Map<string, string> };
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
    // WHAT: Complete the current transaction before the shared count or byte ceiling is crossed.
    // WHY: Relay persistence must acknowledge each bounded unit without exhausting its Durable Object transaction budget.
    if (entries.length > 0 && (candidate.length > federationStateEntityBatchSize || bytes > federationMaximumStateFrameBytes)) {
      frames.push({ deliveryId: randomUUID(), entries });
      entries = [entry];
    } else {
      entries = candidate;
    }
  }
  if (entries.length > 0) frames.push({ deliveryId: randomUUID(), entries });
  for (const frame of frames) {
    const bytes = encoder.encode(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: taskCurrentStateVersion, projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: frame.deliveryId, entries: frame.entries } })).byteLength;
    // WHAT: Reject a single entity that cannot fit within the shared frame ceiling.
    // WHY: Splitting cannot make an individually oversized entity admissible.
    if (bytes > federationMaximumStateFrameBytes) throw new Error('state_frame_too_large');
  }
  return frames;
}

export function createFederationTaskStateReplicator(input: {
  stores: () => Map<string, TaskCurrentStateStore>;
  storeFor?: (projectId: string, ownerNodeId: string) => TaskCurrentStateStore | null;
  publish: Publisher;
  onProjectionChange?: (input: { projectId: string; from: string; delta: TaskStateDelta }) => void;
  onProjectionError?: (input: { projectId: string; from: string; error: unknown }) => void;
}) {
  const convergence = new Map<string, { projectId: string; converged: boolean; lastRepairAt: string; missingBuckets: string[]; root: string }>();
  const runtimeDirty = new Map<string, Map<string, TaskCurrentEntity>>();
  const pendingDeliveries = new Map<string, PendingDelivery>();
  const queuedRelayEntities = new Map<string, Map<string, TaskCurrentEntity>>();
  const activeRepairRequests = new Map<string, string>();
  const servedRepairRequests = new Map<string, { root: string; buckets: Set<string> }>();

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

  const publishRelayBatch = (projectId: string, entities: TaskCurrentEntity[]): boolean => {
    const frame = boundedFrames(projectId, entities)[0];
    // WHAT: Treat an empty relay selection as already published.
    // WHY: The caller may reach this boundary after the queued map settles between reconciliation steps.
    if (!frame) return true;
    const published = input.publish('relay', { type: 'state-entity-batch', projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: frame.deliveryId, entries: frame.entries } });
    // WHAT: Retain the complete queued selection when the current bounded frame did not enter the relay socket.
    // WHY: A transport rejection must remain retryable without reconstructing state from an incomplete delivery record.
    if (!published) return false;
    pendingDeliveries.set(frame.deliveryId, { projectId, hashes: new Map(frame.entries.map((entry) => [entry.key, entry.stateHash])) });
    const queued = queuedRelayEntities.get(projectId);
    // WHAT: Remove every entity owned by the single frame that entered the relay socket.
    // WHY: Later frames must remain queued until the relay acknowledges this transaction.
    for (const entry of frame.entries) queued?.delete(entry.key);
    // WHAT: Remove the project queue after its final bounded frame enters the socket.
    // WHY: The exact acknowledgement remains authoritative through pendingDeliveries while an empty queue must allow the terminal summary.
    if (queued?.size === 0) queuedRelayEntities.delete(projectId);
    return true;
  };

  const advertise = (peerId: string, projectId: string, store: TaskCurrentStateStore): void => {
    input.publish(peerId, { type: 'state-bucket-summary', projectId, payload: { stateVersion: taskCurrentStateVersion, root: store.rootHash(), buckets: store.bucketManifest() } });
  };

  const hasPendingRelayDelivery = (projectId: string): boolean => (
    [...pendingDeliveries.values()].some((delivery) => delivery.projectId === projectId)
  );

  const enqueueRelayEntities = (projectId: string, entities: TaskCurrentEntity[]): void => {
    const queued = queuedRelayEntities.get(projectId) ?? new Map<string, TaskCurrentEntity>();
    for (const entity of entities) queued.set(taskCurrentEntityKey(entity), entity);
    queuedRelayEntities.set(projectId, queued);
  };

  const flushRelayProject = (projectId: string, store: TaskCurrentStateStore): void => {
    // WHAT: Keep the current project batch group in flight until every relay acknowledgement settles.
    // WHY: Publishing a second group before the first settles creates intermediate roots and duplicate repair rounds.
    if (hasPendingRelayDelivery(projectId)) return;
    const queued = queuedRelayEntities.get(projectId);
    // WHAT: Advertise the project root only when no entity batch remains queued.
    // WHY: A root emitted before the final batch is an intermediate state that falsely starts another repair.
    if (!queued?.size) {
      queuedRelayEntities.delete(projectId);
      advertise('relay', projectId, store);
      return;
    }
    const sent = publishRelayBatch(projectId, [...queued.values()]);
    // WHAT: Advertise the durable local root when no frame entered the relay socket.
    // WHY: The relay must discover and request the retained queue after a dropped live publication.
    if (!sent && !hasPendingRelayDelivery(projectId)) advertise('relay', projectId, store);
  };

  const publishDelta = (delta: TaskStateDelta): void => {
    if (delta.entities.length === 0) return;
    const dirty = dirtyFor(delta.projectId);
    for (const entity of delta.entities) dirty.set(taskCurrentEntityKey(entity), entity);
    enqueueRelayEntities(delta.projectId, delta.entities);
    const store = input.stores().get(delta.projectId) ?? input.storeFor?.(delta.projectId, 'relay');
    // WHAT: Start the queued project group only when its local durable store remains available.
    // WHY: The final summary must be derived from the same authoritative store as the queued entities.
    if (store) flushRelayProject(delta.projectId, store);
  };

  const reconcileRelay = (): void => {
    const localStores = input.stores();
    for (const [projectId, store] of localStores) {
      const dirty = runtimeDirty.get(projectId);
      // WHAT: Requeue every unacknowledged durable entity when relay connectivity returns.
      // WHY: Disconnect cleanup removes transport deliveries while durable dirty state remains authoritative.
      if (dirty?.size) enqueueRelayEntities(projectId, [...dirty.values()]);
      flushRelayProject(projectId, store);
    }
    for (const [projectId, dirty] of runtimeDirty) {
      // WHAT: Reconnect remote-project mutations through their materialized replica store.
      // WHY: Federated execution changes are locally durable but are not present in the authoritative local-store map.
      if (localStores.has(projectId)) continue;
      const store = input.storeFor?.(projectId, 'relay');
      // WHAT: Keep a dirty remote-project mutation queued when its replica store is unavailable.
      // WHY: A terminal summary cannot be derived without the durable project store.
      if (!store) continue;
      enqueueRelayEntities(projectId, [...dirty.values()]);
      flushRelayProject(projectId, store);
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
      if (result.changed) {
        try {
          input.onProjectionChange?.({ projectId: frame.projectId, from: frame.from, delta: result.delta });
        } catch (error) {
          // WHAT: Contain a presentation observer failure after the causal merge is durable.
          // WHY: Projection invalidation cannot turn an accepted federation frame into a project-wide outage.
          try { input.onProjectionError?.({ projectId: frame.projectId, from: frame.from, error }); } catch {
            // Diagnostics must not escape the contained observer failure.
          }
        }
      }
      return;
    }

    if (frame.type === 'state-bucket-summary') {
      const remote = Array.isArray(payload.buckets) ? payload.buckets as TaskCurrentBucket[] : [];
      const remoteRoot = String(payload.root ?? '');
      const manifestDigest = assertFederationRepairManifest(remoteRoot, remote);
      const missing = mismatchedBuckets(store.bucketManifest(), remote);
      const root = store.rootHash();
      const converged = missing.length === 0 && remoteRoot === root;
      const repairKey = `${frame.from}\u0000${frame.projectId}`;
      convergence.set(repairKey, { projectId: frame.projectId, converged, lastRepairAt: new Date().toISOString(), missingBuckets: missing, root });
      // WHAT: Settle the active repair when this summary proves exact local and peer root equality.
      // WHY: In node-behind-relay repair the node emits convergence; it does not wait to receive it.
      if (converged) {
        activeRepairRequests.delete(repairKey);
        input.publish(frame.from, { type: 'state-converged', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, root } });
        return;
      }
      const repairIdentity = `${remoteRoot}\u0000${manifestDigest}`;
      // WHAT: Suppress an identical summary while its root generation remains unresolved.
      // WHY: Repeating the same missing request cannot make a permanently divergent peer progress.
      if (activeRepairRequests.get(repairKey) === repairIdentity) return;
      // WHAT: Admit one missing request for a newly observed peer root and manifest.
      // WHY: A changed peer state must remain eligible for normal epoch-4 convergence.
      if (missing.length > 0) {
        const published = input.publish(frame.from, { type: 'state-missing-request', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, buckets: missing } });
        // WHAT: Remember only a successfully published repair request.
        // WHY: Failed transport publication must remain eligible for reconnect reconciliation.
        if (published) activeRepairRequests.set(repairKey, repairIdentity);
      }
      return;
    }

    if (frame.type === 'state-missing-request') {
      const buckets = canonicalFederationRepairBuckets(Array.isArray(payload.buckets) ? payload.buckets : []);
      const requestKey = `${frame.from}\u0000${frame.projectId}`;
      const localRoot = store.rootHash();
      const retained = servedRepairRequests.get(requestKey);
      const served = retained?.root === localRoot ? retained.buckets : new Set<string>();
      const admitted = buckets.filter((bucket) => !served.has(bucket));
      // WHAT: Suppress selections whose buckets were all served for this local root.
      // WHY: Varying overlapping selections must not replay one bucket indefinitely.
      if (admitted.length === 0) return;
      for (const bucket of admitted) served.add(bucket);
      servedRepairRequests.set(requestKey, { root: localRoot, buckets: served });
      const entities = store.entitiesForBuckets(admitted);
      // WHAT: Serialize relay repair responses through the same per-project publication lane as live changes.
      // WHY: A repair response must not overlap a live batch group and expose another intermediate relay root.
      if (frame.from === 'relay') {
        const dirty = dirtyFor(frame.projectId);
        for (const entity of entities) dirty.set(taskCurrentEntityKey(entity), entity);
        enqueueRelayEntities(frame.projectId, entities);
        flushRelayProject(frame.projectId, store);
      } else {
        publishEntities(frame.from, frame.projectId, entities);
        advertise(frame.from, frame.projectId, store);
      }
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
      // WHAT: Advance the queued project lane only after its entire current batch group settles.
      // WHY: Per-frame advancement would reintroduce intermediate summaries for multi-frame groups.
      if (!hasPendingRelayDelivery(frame.projectId)) flushRelayProject(frame.projectId, store);
    }
  };

  const disconnectPeer = (peerId: string): void => {
    for (const key of [...convergence.keys()]) {
      // WHAT: Remove convergence observations owned by the disconnected peer only.
      // WHY: A prior socket's terminal root cannot prove the replacement socket has synchronized.
      if (key.startsWith(`${peerId}\u0000`)) convergence.delete(key);
    }
    // WHAT: Retire relay delivery identities when the relay socket disconnects.
    // WHY: Their acknowledgements can never arrive, while runtimeDirty retains the durable retry authority.
    if (peerId === 'relay') pendingDeliveries.clear();
  };

  return {
    publishDelta,
    reconcileRelay,
    reconcileProject,
    handleFrame,
    disconnectPeer,
    diagnostics: () => ({
      convergence: [...convergence].map(([key, value]) => ({ peerId: key.split('\u0000')[0], ...value })),
      runtimeDirty: [...runtimeDirty].flatMap(([projectId, entities]) => [...entities].map(([entityKey, entity]) => ({ projectId, entityKey, stateHash: entity.stateHash }))),
      pendingDeliveryIds: [...pendingDeliveries.keys()],
      queuedRelayEntityCount: [...queuedRelayEntities.values()].reduce((count, entities) => count + entities.size, 0),
      activeRepairCount: activeRepairRequests.size,
    }),
  };
}
