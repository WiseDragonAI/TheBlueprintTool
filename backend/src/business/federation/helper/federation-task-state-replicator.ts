/**
 * WHAT: Delivers correlated, byte-bounded epoch-4 entity state and closes root repair loops.
 * WHY: Dirty state clears only after exact relay acknowledgement and synchronization requires equal roots.
 */
import { randomUUID } from 'node:crypto';
import { assertFederationRepairManifest, canonicalFederationRepairBuckets } from '../../../../../shared/federation-repair-guard.js';
import { taskCurrentEntityKey } from '../../../../../shared/task-current-state-core.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import { taskCurrentStateVersion, type TaskCurrentBucket, type TaskCurrentEntity, type TaskStateDelta } from '../../task-state/helper/task-current-state-types.js';
import type { FederationStateFrame } from './federation-node-connector.js';

type Publisher = (peerId: string, frame: Omit<FederationStateFrame, 'from'>) => boolean;
type StateEnvelope = { key: string; stateHash: string; entity: TaskCurrentEntity };
type PendingDelivery = { projectId: string; hashes: Map<string, string>; encodedBytes: number };
const maximumBatchEntities = 128;
const maximumStateFrameBytes = 512 * 1024;
const maximumProjectDeliveries = 4;
const maximumConnectionDeliveries = 16;
const maximumConnectionDeliveryBytes = 16 * 1024 * 1024;
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

function nextBoundedFrame(projectId: string, entities: TaskCurrentEntity[]): { deliveryId: string; entries: StateEnvelope[] } {
  const deliveryId = randomUUID();
  const entries: StateEnvelope[] = [];
  for (const entry of envelopes(entities)) {
    const candidate = [...entries, entry];
    const bytes = encoder.encode(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: taskCurrentStateVersion, projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId, entries: candidate } })).byteLength;
    // WHAT: Stop at the first entry that would cross a wire ceiling.
    // WHY: The scheduler must encode only its next admitted frame, not the full catalog.
    if (entries.length > 0 && (candidate.length > maximumBatchEntities || bytes > maximumStateFrameBytes)) break;
    entries.push(entry);
  }
  const frame = entries.length > 0 ? { deliveryId, entries } : undefined;
  // WHAT: Reject an empty publication candidate before queue mutation.
  // WHY: Only a concrete bounded frame can consume delivery-window credit.
  if (!frame) throw new Error('empty_state_frame');
  return frame;
}

export function createFederationTaskStateReplicator(input: {
  stores: () => Map<string, TaskCurrentStateStore>;
  storeFor?: (projectId: string, ownerNodeId: string) => TaskCurrentStateStore | null;
  publish: Publisher;
  onProjectionChange?: (input: { projectId: string; from: string; delta: TaskStateDelta }) => void;
  onProjectionError?: (input: { projectId: string; from: string; error: unknown }) => void;
  onRepairTimeout?: (input: { projectId: string; from: string; attemptId: string }) => void;
  noProgressTimeoutMs?: number;
}) {
  const convergence = new Map<string, { projectId: string; converged: boolean; lastRepairAt: string; missingBuckets: string[]; root: string }>();
  const runtimeDirty = new Map<string, Map<string, TaskCurrentEntity>>();
  const pendingDeliveries = new Map<string, PendingDelivery>();
  const queuedRelayEntities = new Map<string, Map<string, TaskCurrentEntity>>();
  let relayProjectOrder: string[] = [];
  const activeRepairRequests = new Map<string, { summaryIdentity: string; attemptId: string; timeout: NodeJS.Timeout }>();
  const servedRepairRequests = new Map<string, { root: string; buckets: Set<string> }>();
  const noProgressTimeoutMs = input.noProgressTimeoutMs ?? 15_000;

  const clearActiveRepair = (repairKey: string): void => {
    const active = activeRepairRequests.get(repairKey);
    // WHAT: Clear the owned deadline before removing active repair authority.
    // WHY: A settled or disconnected attempt must not fire a stale project timeout.
    if (active) clearTimeout(active.timeout);
    activeRepairRequests.delete(repairKey);
  };

  const armRepairDeadline = (repairKey: string, summaryIdentity: string, attemptId: string): void => {
    clearActiveRepair(repairKey);
    const timeout = setTimeout(() => {
      activeRepairRequests.delete(repairKey);
      const [from, projectId] = repairKey.split('\u0000');
      try { input.onRepairTimeout?.({ projectId, from, attemptId }); } catch {
        // Timeout diagnostics cannot escape into the timer boundary.
      }
    }, noProgressTimeoutMs);
    timeout.unref?.();
    activeRepairRequests.set(repairKey, { summaryIdentity, attemptId, timeout });
  };

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
      // WHAT: Track in-flight credit only for a relay-bound frame accepted by the socket.
      // WHY: Direct repair and rejected publication do not own relay acknowledgement state.
      if (published && peerId === 'relay') {
        const encodedBytes = encoder.encode(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: taskCurrentStateVersion, projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: frame.deliveryId, entries: frame.entries } })).byteLength;
        pendingDeliveries.set(frame.deliveryId, { projectId, hashes: new Map(frame.entries.map((entry) => [entry.key, entry.stateHash])), encodedBytes });
      }
    }
    return sent;
  };

  const advertise = (peerId: string, projectId: string, store: TaskCurrentStateStore): void => {
    input.publish(peerId, { type: 'state-bucket-summary', projectId, payload: { stateVersion: taskCurrentStateVersion, root: store.rootHash(), buckets: store.bucketManifest() } });
  };

  const enqueueRelayEntities = (projectId: string, entities: TaskCurrentEntity[]): void => {
    const queued = queuedRelayEntities.get(projectId) ?? new Map<string, TaskCurrentEntity>();
    for (const entity of entities) queued.set(taskCurrentEntityKey(entity), entity);
    queuedRelayEntities.set(projectId, queued);
    // WHAT: Admit the project once at the front of the round-robin queue.
    // WHY: Newly ready small projects must receive the next available global slot.
    if (!relayProjectOrder.includes(projectId)) relayProjectOrder.unshift(projectId);
  };

  const scheduleRelayPublications = (): void => {
    let idleProjects = 0;
    while (relayProjectOrder.length > 0 && pendingDeliveries.size < maximumConnectionDeliveries) {
      const encodedInFlight = [...pendingDeliveries.values()].reduce((total, delivery) => total + delivery.encodedBytes, 0);
      // WHAT: Stop publication at the connection-wide byte ceiling.
      // WHY: Entity count alone does not bound encoded causal state.
      if (encodedInFlight >= maximumConnectionDeliveryBytes) break;
      const projectId = relayProjectOrder.shift()!;
      relayProjectOrder.push(projectId);
      const store = input.stores().get(projectId) ?? input.storeFor?.(projectId, 'relay');
      // WHAT: Keep queued state dormant while its durable project store is unavailable.
      // WHY: A terminal root must come from the same authority as the entities.
      if (!store) {
        idleProjects += 1;
        // WHAT: Stop after every queued project lacks a usable durable store.
        // WHY: Repeating the same pass cannot create publication authority.
        if (idleProjects >= relayProjectOrder.length) break;
        continue;
      }
      const projectPending = [...pendingDeliveries.values()].filter((delivery) => delivery.projectId === projectId).length;
      const queued = queuedRelayEntities.get(projectId);
      // WHAT: Emit the terminal summary only after queue and acknowledgements are empty.
      // WHY: Intermediate roots create duplicate reverse-repair rounds.
      if (!queued?.size && projectPending === 0) {
        queuedRelayEntities.delete(projectId);
        relayProjectOrder = relayProjectOrder.filter((candidate) => candidate !== projectId);
        advertise('relay', projectId, store);
        idleProjects = 0;
        continue;
      }
      // WHAT: Leave the project queued while its four-delivery window is full.
      // WHY: Acknowledgement owns admission of the next frame.
      if (!queued?.size || projectPending >= maximumProjectDeliveries) {
        idleProjects += 1;
        // WHAT: Stop after every project is waiting for acknowledgement or new state.
        // WHY: Another pass would spin without freeing delivery credit.
        if (idleProjects >= relayProjectOrder.length) break;
        continue;
      }
      const frame = nextBoundedFrame(projectId, [...queued.values()]);
      const encodedBytes = encoder.encode(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: taskCurrentStateVersion, projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: frame.deliveryId, entries: frame.entries } })).byteLength;
      // WHAT: Defer a frame that would exceed remaining global byte credit.
      // WHY: Flow control must hold before transport publication.
      if (encodedInFlight + encodedBytes > maximumConnectionDeliveryBytes && pendingDeliveries.size > 0) break;
      const published = input.publish('relay', { type: 'state-entity-batch', projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId: frame.deliveryId, entries: frame.entries } });
      // WHAT: Retain every queued entity when the socket rejects publication.
      // WHY: Reconnect reconciliation must be able to retry the complete unconfirmed frame.
      if (!published) {
        // WHAT: Advertise retained durable state when no delivery entered the socket.
        // WHY: The relay must discover and request the queue after a dropped live publication.
        if (projectPending === 0) advertise('relay', projectId, store);
        break;
      }
      for (const entry of frame.entries) queued.delete(entry.key);
      pendingDeliveries.set(frame.deliveryId, { projectId, hashes: new Map(frame.entries.map((entry) => [entry.key, entry.stateHash])), encodedBytes });
      idleProjects = 0;
    }
  };

  const flushRelayProject = (projectId: string, _store: TaskCurrentStateStore): void => {
    // WHAT: Keep the existing call boundary while delegating admission to the global scheduler.
    // WHY: Live, reconnect, and repair publication must share one connection budget.
    if (!relayProjectOrder.includes(projectId)) relayProjectOrder.unshift(projectId);
    scheduleRelayPublications();
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
      // WHAT: Retain an unchanged local project in the reconnect comparison schedule.
      // WHY: Equal durable state still requires one terminal summary exchange.
      if (!relayProjectOrder.includes(projectId)) relayProjectOrder.unshift(projectId);
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
      // WHAT: Retain the recovered remote project once in the publication schedule.
      // WHY: Its durable dirty state must share the global reconnect window.
      if (!relayProjectOrder.includes(projectId)) relayProjectOrder.unshift(projectId);
    }
    scheduleRelayPublications();
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
      const accepted = entries.map((entry) => ({
        key: entry.key,
        stateHash: entry.stateHash,
        resultingStateHash: store.entity(entry.entity.entityType, entry.entity.entityId)?.stateHash ?? '',
      }));
      input.publish(frame.from, {
        type: frame.from === 'relay' ? 'state-relay-ack' : 'state-ack',
        projectId: frame.projectId,
        payload: { stateVersion: taskCurrentStateVersion, deliveryId: payload.deliveryId, accepted, root: store.rootHash(), ...(payload.attemptId ? { attemptId: payload.attemptId } : {}) },
      });
      const repairKey = `${frame.from}\u0000${frame.projectId}`;
      const active = activeRepairRequests.get(repairKey);
      // WHAT: Renew the finite deadline only after durable receiver application advances.
      // WHY: Socket traffic without a successful merge is not synchronization progress.
      if (active && payload.attemptId === active.attemptId) armRepairDeadline(repairKey, active.summaryIdentity, active.attemptId);
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
        const active = activeRepairRequests.get(repairKey);
        clearActiveRepair(repairKey);
        input.publish(frame.from, { type: 'state-converged', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, root, ...(active ? { attemptId: active.attemptId } : {}) } });
        return;
      }
      const summaryIdentity = `${remoteRoot}\u0000${manifestDigest}`;
      const attemptId = `${remoteRoot}:${root}`;
      // WHAT: Suppress an identical summary while its root generation remains unresolved.
      // WHY: Repeating the same missing request cannot make a permanently divergent peer progress.
      if (activeRepairRequests.get(repairKey)?.summaryIdentity === summaryIdentity) return;
      // WHAT: Admit one missing request for a newly observed peer root and manifest.
      // WHY: A changed peer state must remain eligible for normal epoch-4 convergence.
      if (missing.length > 0) {
        const published = input.publish(frame.from, {
          type: 'state-missing-request',
          projectId: frame.projectId,
          payload: { stateVersion: taskCurrentStateVersion, buckets: missing, attemptId, relayRoot: remoteRoot, receiverRoot: root },
        });
        // WHAT: Remember only a successfully published repair request.
        // WHY: Failed transport publication must remain eligible for reconnect reconciliation.
        if (published) armRepairDeadline(repairKey, summaryIdentity, attemptId);
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
      scheduleRelayPublications();
    }
  };

  const disconnectPeer = (peerId: string): void => {
    for (const key of [...convergence.keys()]) {
      // WHAT: Remove convergence observations owned by the disconnected peer only.
      // WHY: A prior socket's terminal root cannot prove the replacement socket has synchronized.
      if (key.startsWith(`${peerId}\u0000`)) convergence.delete(key);
    }
    for (const key of [...activeRepairRequests.keys()]) {
      // WHAT: Forget request suppression owned by the disconnected transport.
      // WHY: A frame sent before disconnect may not have reached durable receiver application.
      if (key.startsWith(`${peerId}\u0000`)) clearActiveRepair(key);
    }
    for (const key of [...servedRepairRequests.keys()]) {
      // WHAT: Forget response suppression owned by the disconnected transport.
      // WHY: The replacement connection must be able to recover an unacknowledged transfer.
      if (key.startsWith(`${peerId}\u0000`)) servedRepairRequests.delete(key);
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
