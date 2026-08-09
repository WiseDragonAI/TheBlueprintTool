/**
 * WHAT: Delivers correlated, byte-bounded epoch-4 entity state and closes root repair loops.
 * WHY: Dirty state clears only after exact relay acknowledgement and synchronization requires equal roots.
 */
import { randomUUID } from 'node:crypto';
import { assertFederationRepairManifest, canonicalFederationRepairBuckets } from '../../../../../shared/federation-repair-guard.js';
import { normalizeFederationStateRejection } from '../../../../../shared/federation-state-transport.js';
import { joinTaskEntities, taskCurrentEntityKey } from '../../../../../shared/task-current-state-core.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import type { TaskRepairCollisionEvidence, TaskRepairCollisionRejection } from '../../task-state/helper/task-current-state-types.js';
import { taskCurrentStateVersion, type TaskCurrentBucket, type TaskCurrentEntity, type TaskStateDelta } from '../../task-state/helper/task-current-state-types.js';
import type { FederationStateFrame } from './federation-node-connector.js';

type Publisher = (peerId: string, frame: Omit<FederationStateFrame, 'from'>) => boolean;
type StateEnvelope = { key: string; stateHash: string; entity: TaskCurrentEntity };
type PendingDelivery = { projectId: string; hashes: Map<string, string>; entities: Map<string, TaskCurrentEntity>; encodedBytes: number };
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
  onRepairCollision?: (input: { projectId: string; from: string; attemptId: string; deliveryId: string; relayRoot: string; rejected: TaskRepairCollisionRejection[]; evidence: TaskRepairCollisionEvidence[] }) => void;
  noProgressTimeoutMs?: number;
}) {
  const convergence = new Map<string, { projectId: string; converged: boolean; lastRepairAt: string; missingBuckets: string[]; root: string }>();
  const runtimeDirty = new Map<string, Map<string, TaskCurrentEntity>>();
  const pendingDeliveries = new Map<string, PendingDelivery>();
  const queuedRelayEntities = new Map<string, Map<string, TaskCurrentEntity>>();
  let relayProjectOrder: string[] = [];
  const activeRepairRequests = new Map<string, { summaryIdentity: string; attemptId: string; timeout: NodeJS.Timeout; store: TaskCurrentStateStore }>();
  const terminalRepairAttempts = new Map<string, string>();
  const terminalPublicationHashes = new Map<string, Map<string, string>>();
  const servedRepairRequests = new Map<string, { root: string; buckets: Set<string> }>();
  const deferredObservers = new Map<string, { attemptId: string; store: TaskCurrentStateStore; keys: Set<string> }>();
  type EnhancedRepairFrame = { frame: FederationStateFrame; entries: StateEnvelope[]; attemptId: string; store: TaskCurrentStateStore; encodedBytes: number; resolve: () => void; reject: (error: unknown) => void };
  const enhancedRepairFrames = new Map<string, EnhancedRepairFrame[]>();
  let enhancedRepairFrameCount = 0;
  let enhancedRepairBytes = 0;
  let enhancedRepairDrain: Promise<void> | null = null;
  let enhancedRepairImmediate: NodeJS.Immediate | null = null;
  const noProgressTimeoutMs = input.noProgressTimeoutMs ?? 15_000;
  const receiverTiming = { frameCount: 0, entityCount: 0, validationMs: 0, mergeMs: 0, acknowledgementMs: 0, observerMs: 0, observerDeferredFrameCount: 0, observerFlushCount: 0, pendingObserverCount: 0, groupCommitCount: 0, groupCommitFrameCount: 0 };
  const readyObservers: Array<{ identity: string; projectId: string; from: string; delta: TaskStateDelta }> = [];
  const readyObserverIdentities = new Set<string>();
  let observerDrain: NodeJS.Immediate | null = null;
  let observerDeferralDeadline: NodeJS.Timeout | null = null;

  const invokeObserver = (projectId: string, from: string, delta: TaskStateDelta): void => {
    const observerStartedAt = performance.now();
    try {
      input.onProjectionChange?.({ projectId, from, delta });
    } catch (error) {
      // WHAT: Contain a presentation observer failure after the causal merge is durable.
      // WHY: Projection invalidation cannot turn accepted federation state into a project outage.
      try { input.onProjectionError?.({ projectId, from, error }); } catch {
        // Diagnostics must not escape the contained observer failure.
      }
    }
    receiverTiming.observerMs += performance.now() - observerStartedAt;
  };

  const maybeScheduleObserverDrain = (force = false): void => {
    if ((!force && activeRepairRequests.size > 0) || readyObservers.length === 0 || observerDrain) return;
    observerDrain = setImmediate(() => {
      observerDrain = null;
      // WHAT: Recheck global repair activity after yielding to queued socket work.
      // WHY: A newly admitted attempt retains priority unless the independent deadline forced this drain.
      if (!force && activeRepairRequests.size > 0) return;
      const ready = readyObservers.splice(0);
      readyObserverIdentities.clear();
      if (observerDeferralDeadline) clearTimeout(observerDeferralDeadline);
      observerDeferralDeadline = null;
      for (const observer of ready) {
        try {
          invokeObserver(observer.projectId, observer.from, observer.delta);
          receiverTiming.observerFlushCount += 1;
        } finally {
          receiverTiming.pendingObserverCount -= 1;
        }
      }
      maybeScheduleObserverDrain();
    });
  };

  const queueDeferredObserver = (repairKey: string, attemptId: string): void => {
    const deferred = deferredObservers.get(repairKey);
    // WHAT: Ignore stale or empty attempt releases.
    // WHY: A prior summary must never flush a replacement repair's application work.
    if (!deferred || deferred.attemptId !== attemptId) return;
    deferredObservers.delete(repairKey);
    const [from, projectId] = repairKey.split('\u0000');
    const delta = deferred.store.activeDelta([...deferred.keys].sort());
    const identity = `${repairKey}\u0000${attemptId}`;
    // WHAT: Queue each settled attempt snapshot once across overlapping terminal paths.
    // WHY: Convergence followed by disconnect must not duplicate derived effects.
    if (readyObserverIdentities.has(identity)) return;
    readyObserverIdentities.add(identity);
    readyObservers.push({ identity, projectId, from, delta });
    receiverTiming.pendingObserverCount += 1;
    // WHAT: Bound derived-effect deferral independently from renewable repair progress.
    // WHY: A continuously progressing large repair must not starve prior UI/content visibility forever.
    if (!observerDeferralDeadline) {
      observerDeferralDeadline = setTimeout(() => {
        observerDeferralDeadline = null;
        // WHAT: Replace an idle-gated drain with the finite forced drain.
        // WHY: A previously queued Immediate must not suppress the liveness deadline.
        if (observerDrain) {
          clearImmediate(observerDrain);
          observerDrain = null;
        }
        maybeScheduleObserverDrain(true);
      }, noProgressTimeoutMs);
      observerDeferralDeadline.unref?.();
    }
  };

  const clearActiveRepair = (repairKey: string): void => {
    const active = activeRepairRequests.get(repairKey);
    // WHAT: Clear the owned deadline before removing active repair authority.
    // WHY: A settled or disconnected attempt must not fire a stale project timeout.
    if (active) {
      clearTimeout(active.timeout);
      active.store.resumeMaterialization(active.attemptId);
    }
    activeRepairRequests.delete(repairKey);
  };

  const armRepairDeadline = (repairKey: string, summaryIdentity: string, attemptId: string, store: TaskCurrentStateStore): void => {
    const previous = activeRepairRequests.get(repairKey);
    // WHAT: Replace only a superseded repair lease while renewing the current attempt in place.
    // WHY: Progress renewal must not start shard compaction during the same active repair.
    if (previous) {
      clearTimeout(previous.timeout);
      // WHAT: Release accepted partial application work only when a new attempt supersedes it.
      // WHY: Same-attempt progress renewal must preserve coalescing and materialization deferral.
      if (previous.attemptId !== attemptId) {
        queueDeferredObserver(repairKey, previous.attemptId);
        previous.store.resumeMaterialization(previous.attemptId);
      }
    }
    const timeout = setTimeout(() => {
      activeRepairRequests.delete(repairKey);
      queueDeferredObserver(repairKey, attemptId);
      store.resumeMaterialization(attemptId);
      const [from, projectId] = repairKey.split('\u0000');
      try { input.onRepairTimeout?.({ projectId, from, attemptId }); } catch {
        // Timeout diagnostics cannot escape into the timer boundary.
      }
      maybeScheduleObserverDrain();
    }, noProgressTimeoutMs);
    timeout.unref?.();
    activeRepairRequests.set(repairKey, { summaryIdentity, attemptId, timeout, store });
  };

  const drainEnhancedRepairFrames = async (): Promise<void> => {
    const groups = [...enhancedRepairFrames.entries()];
    enhancedRepairFrames.clear();
    enhancedRepairFrameCount = 0;
    enhancedRepairBytes = 0;
    await Promise.all(groups.map(async ([repairKey, frames]) => {
      const [from, projectId] = repairKey.split('\u0000');
      const first = frames[0];
      const active = activeRepairRequests.get(repairKey);
      // WHAT: Reject a queued group whose attempt authority changed before durability.
      // WHY: Replacement and disconnect must never ACK frames under a stale repair lease.
      if (!first || !active || active.attemptId !== first.attemptId || frames.some((candidate) => candidate.attemptId !== first.attemptId || candidate.store !== first.store)) {
        for (const candidate of frames) candidate.resolve();
        return;
      }
      try {
        const mergeStartedAt = performance.now();
        const result = await first.store.mergeRepairGroup(frames.map(({ frame, entries, attemptId }) => ({
          attemptId,
          deliveryId: String((frame.payload as Record<string, unknown>).deliveryId ?? ''),
          delta: { version: taskCurrentStateVersion, projectId, entities: entries.map((entry) => entry.entity) },
        })), first.attemptId);
        receiverTiming.groupCommitCount += 1;
        receiverTiming.groupCommitFrameCount += frames.length;
        receiverTiming.mergeMs += performance.now() - mergeStartedAt;
        const acknowledgementStartedAt = performance.now();
        for (const [index, candidate] of frames.entries()) {
          const payload = candidate.frame.payload as Record<string, unknown>;
          const deliveryResult = result.deliveries[index];
          input.publish(from, {
            type: 'state-relay-ack',
            projectId,
            payload: {
              stateVersion: taskCurrentStateVersion,
              deliveryId: payload.deliveryId,
              accepted: deliveryResult.accepted.map((entry) => ({ key: entry.key, stateHash: entry.stateHash, resultingStateHash: entry.receiverStateHash })),
              rejected: deliveryResult.rejected,
              root: first.store.rootHash(),
              attemptId: first.attemptId,
            },
          });
          // WHAT: Convert a durable mixed-delivery collision into an immediate terminal repair signal.
          // WHY: The owning project must pause from exact evidence instead of expiring as generic no-progress.
          if (deliveryResult.rejected.length > 0) {
            terminalRepairAttempts.set(repairKey, active.summaryIdentity);
            try { input.onRepairCollision?.({ projectId, from, attemptId: first.attemptId, deliveryId: deliveryResult.deliveryId, relayRoot: first.attemptId.split(':')[0] ?? '', rejected: deliveryResult.rejected, evidence: first.store.repairCollisionEvidence(first.attemptId) }); } catch {
              // Collision diagnostics cannot invalidate the already durable ACK partition.
            }
          }
        }
        receiverTiming.acknowledgementMs += performance.now() - acknowledgementStartedAt;
        const retained = activeRepairRequests.get(repairKey);
        // WHAT: Renew progress only while the durable group still owns the active attempt.
        // WHY: A replacement lease cannot inherit progress from an older WAL group.
        if (retained?.attemptId === first.attemptId && terminalRepairAttempts.get(repairKey) !== retained.summaryIdentity) armRepairDeadline(repairKey, retained.summaryIdentity, retained.attemptId, first.store);
        // WHAT: Coalesce one durable group into the attempt-owned application observer.
        // WHY: Individual transport frames have no derived UI authority before terminal root equality.
        if (result.delta.entities.length > 0) {
          const deferred = deferredObservers.get(repairKey) ?? { attemptId: first.attemptId, store: first.store, keys: new Set<string>() };
          for (const entity of result.delta.entities) deferred.keys.add(taskCurrentEntityKey(entity));
          deferredObservers.set(repairKey, deferred);
          receiverTiming.observerDeferredFrameCount += frames.length;
        }
        // WHAT: Settle the receiver lease after durable collision evidence and healthy observer capture.
        // WHY: A terminal attempt must neither time out nor discard healthy entities accepted beside the rejection.
        if (terminalRepairAttempts.get(repairKey) === active.summaryIdentity) {
          queueDeferredObserver(repairKey, first.attemptId);
          clearActiveRepair(repairKey);
          maybeScheduleObserverDrain();
        }
        for (const candidate of frames) candidate.resolve();
      } catch (error) {
        // WHAT: Contain one project group's validation or durability failure without ACKing it.
        // WHY: Sibling project groups must continue while the owning store retains recovery authority.
        try { input.onProjectionError?.({ projectId, from, error }); } catch {
          // Diagnostics cannot replace the original contained group failure.
        }
        for (const candidate of frames) candidate.reject(error);
      }
    }));
  };

  const startEnhancedRepairDrain = (): Promise<void> => {
    // WHAT: Reuse the active bounded drain when another barrier observes it.
    // WHY: Summary and disconnect barriers must await one ordered receiver transaction.
    if (enhancedRepairDrain) return enhancedRepairDrain;
    enhancedRepairDrain = drainEnhancedRepairFrames().finally(() => {
      enhancedRepairDrain = null;
      // WHAT: Schedule frames that arrived while the previous bounded group was syncing.
      // WHY: Relay window replenishment must not strand a second receiver group.
      if (enhancedRepairFrames.size > 0) scheduleEnhancedRepairDrain();
    });
    return enhancedRepairDrain;
  };

  const scheduleEnhancedRepairDrain = (): void => {
    // WHAT: Collect the relay's current bounded window for one event-loop turn.
    // WHY: Four project frames can share one WAL fsync without adding a time-based durability delay.
    if (enhancedRepairImmediate || enhancedRepairDrain) return;
    enhancedRepairImmediate = setImmediate(() => {
      enhancedRepairImmediate = null;
      void startEnhancedRepairDrain();
    });
  };

  const flushEnhancedRepairFrames = async (): Promise<void> => {
    // WHAT: Cancel deferred scheduling and drain every queued group before an ordering boundary.
    // WHY: Summary, replacement, and non-enhanced traffic must never overtake durable repair application.
    if (enhancedRepairImmediate) {
      clearImmediate(enhancedRepairImmediate);
      enhancedRepairImmediate = null;
    }
    do {
      if (enhancedRepairFrames.size > 0 && !enhancedRepairDrain) startEnhancedRepairDrain();
      if (enhancedRepairDrain) await enhancedRepairDrain;
    } while (enhancedRepairFrames.size > 0);
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
        pendingDeliveries.set(frame.deliveryId, { projectId, hashes: new Map(frame.entries.map((entry) => [entry.key, entry.stateHash])), entities: new Map(frame.entries.map((entry) => [entry.key, structuredClone(entry.entity)])), encodedBytes });
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
      pendingDeliveries.set(frame.deliveryId, { projectId, hashes: new Map(frame.entries.map((entry) => [entry.key, entry.stateHash])), entities: new Map(frame.entries.map((entry) => [entry.key, structuredClone(entry.entity)])), encodedBytes });
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
    for (const entity of delta.entities) {
      const key = taskCurrentEntityKey(entity);
      dirty.set(key, entity);
      const blocked = terminalPublicationHashes.get(delta.projectId);
      // WHAT: Release a terminal publication block only when a fresh local successor changes the rejected hash.
      // WHY: The poisoned hash must stay suppressed across reconnect while explicit recovery remains publishable.
      if (blocked?.get(key) && blocked.get(key) !== entity.stateHash) blocked.delete(key);
      if (blocked?.size === 0) terminalPublicationHashes.delete(delta.projectId);
    }
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
      if (dirty?.size) {
        const blocked = terminalPublicationHashes.get(projectId);
        enqueueRelayEntities(projectId, [...dirty.entries()].filter(([key, entity]) => blocked?.get(key) !== entity.stateHash).map(([, entity]) => entity));
      }
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
      const blocked = terminalPublicationHashes.get(projectId);
      enqueueRelayEntities(projectId, [...dirty.entries()].filter(([key, entity]) => blocked?.get(key) !== entity.stateHash).map(([, entity]) => entity));
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

    // WHAT: Drain enhanced entity groups before every other state transition.
    // WHY: Summaries, replacements, legacy traffic, and ACK processing must observe prior durable receiver order.
    if (frame.type !== 'state-entity-batch') await flushEnhancedRepairFrames();

    if (frame.type === 'state-summary-request') {
      advertise(frame.from, frame.projectId, store);
      return;
    }

    if (frame.type === 'state-entity-batch') {
      receiverTiming.frameCount += 1;
      const entries = Array.isArray(payload.entries) ? payload.entries as StateEnvelope[] : [];
      receiverTiming.entityCount += entries.length;
      const validationStartedAt = performance.now();
      for (const entry of entries) if (entry.key !== taskCurrentEntityKey(entry.entity) || entry.stateHash !== entry.entity.stateHash) throw new Error('invalid_state_entity_envelope');
      receiverTiming.validationMs += performance.now() - validationStartedAt;
      const repairKey = `${frame.from}\u0000${frame.projectId}`;
      const active = activeRepairRequests.get(repairKey);
      const retainedCollisionEvidence = frame.from === 'relay' && typeof payload.attemptId === 'string' && typeof payload.deliveryId === 'string'
        ? store.repairCollisionEvidence(payload.attemptId).filter((evidence) => evidence.deliveryId === payload.deliveryId)
        : [];
      // WHAT: Reproduce the durable mixed disposition when the relay retries a collision delivery after losing its ACK.
      // WHY: Clearing the active repair must not turn the same enhanced delivery into an ordinary all-or-nothing merge on reconnect.
      if (!active && retainedCollisionEvidence.length > 0) {
        const rejectedByKey = new Map(retainedCollisionEvidence.map((evidence) => [evidence.key, evidence]));
        const accepted: Array<{ key: string; stateHash: string; resultingStateHash: string }> = [];
        const rejected: ReturnType<typeof normalizeFederationStateRejection>[] = [];
        for (const entry of entries) {
          const evidence = rejectedByKey.get(entry.key);
          // WHAT: Re-emit only collision evidence bound to the exact submitted entity hash.
          // WHY: A changed delivery cannot inherit a terminal disposition from older durable bytes.
          if (evidence) {
            if (evidence.stateHash !== entry.stateHash || evidence.remoteEntity.stateHash !== entry.entity.stateHash) throw new Error('invalid_terminal_repair_replay');
            rejected.push(normalizeFederationStateRejection({
              code: evidence.code,
              collisions: evidence.collisions,
              key: evidence.key,
              receiverStateHash: evidence.receiverStateHash,
              stateHash: evidence.stateHash,
            }));
            continue;
          }
          const current = store.entity(entry.entity.entityType, entry.entity.entityId);
          // WHAT: Accept a replayed healthy entry only when the current durable entity already incorporates it.
          // WHY: Lost-ACK replay must never acknowledge state that was not installed before the terminal collision settled.
          if (!current || joinTaskEntities(current, entry.entity).stateHash !== current.stateHash) throw new Error('invalid_terminal_repair_replay');
          accepted.push({ key: entry.key, stateHash: entry.stateHash, resultingStateHash: current.stateHash });
        }
        // WHAT: Require every retained collision coordinate to appear in the replayed delivery.
        // WHY: Partial replay cannot silently discard terminal evidence from the original durable partition.
        if (rejected.length !== retainedCollisionEvidence.length) throw new Error('invalid_terminal_repair_replay');
        input.publish('relay', {
          type: 'state-relay-ack',
          projectId: frame.projectId,
          payload: { stateVersion: taskCurrentStateVersion, deliveryId: payload.deliveryId, attemptId: payload.attemptId, accepted, rejected, root: store.rootHash() },
        });
        return;
      }
      const enhancedRelayRepair = frame.from === 'relay' && typeof payload.attemptId === 'string' && payload.attemptId === active?.attemptId;
      if (enhancedRelayRepair) {
        const encodedBytes = Buffer.byteLength(JSON.stringify(frame));
        const retained = enhancedRepairFrames.get(repairKey) ?? [];
        // WHAT: Admit only the epoch-4 relay window already bounded by project, connection, and bytes.
        // WHY: Receiver group commit must not introduce capacity beyond the transport contract it optimizes.
        if (retained.length >= maximumProjectDeliveries || enhancedRepairFrameCount >= maximumConnectionDeliveries
          || (enhancedRepairBytes + encodedBytes > maximumConnectionDeliveryBytes && enhancedRepairFrameCount > 0)) {
          await flushEnhancedRepairFrames();
        }
        const current = enhancedRepairFrames.get(repairKey) ?? [];
        return new Promise<void>((resolveFrame, rejectFrame) => {
          enhancedRepairFrames.set(repairKey, [...current, { frame, entries, attemptId: active!.attemptId, store, encodedBytes, resolve: resolveFrame, reject: rejectFrame }]);
          enhancedRepairFrameCount += 1;
          enhancedRepairBytes += encodedBytes;
          scheduleEnhancedRepairDrain();
        });
      }
      await flushEnhancedRepairFrames();
      const mergeStartedAt = performance.now();
      const result = await store.merge(
        { version: taskCurrentStateVersion, projectId: frame.projectId, entities: entries.map((entry) => entry.entity) },
        enhancedRelayRepair ? { deferMaterialization: active!.attemptId } : {},
      );
      receiverTiming.mergeMs += performance.now() - mergeStartedAt;
      const acknowledgementStartedAt = performance.now();
      const accepted = entries.map((entry) => ({
        key: entry.key,
        stateHash: entry.stateHash,
        resultingStateHash: result.resultingStateHashes.get(entry.key) ?? '',
      }));
      input.publish(frame.from, {
        type: frame.from === 'relay' ? 'state-relay-ack' : 'state-ack',
        projectId: frame.projectId,
        payload: { stateVersion: taskCurrentStateVersion, deliveryId: payload.deliveryId, accepted, root: store.rootHash(), ...(payload.attemptId ? { attemptId: payload.attemptId } : {}) },
      });
      receiverTiming.acknowledgementMs += performance.now() - acknowledgementStartedAt;
      // WHAT: Renew the finite deadline only after durable receiver application advances.
      // WHY: Socket traffic without a successful merge is not synchronization progress.
      if (active && payload.attemptId === active.attemptId) armRepairDeadline(repairKey, active.summaryIdentity, active.attemptId, store);
      if (result.changed) {
        // WHAT: Coalesce derived application work only for the exact enhanced relay attempt.
        // WHY: Intermediate repair cuts have no application authority and must not block the socket queue.
        if (enhancedRelayRepair) {
          const deferred = deferredObservers.get(repairKey) ?? { attemptId: active!.attemptId, store, keys: new Set<string>() };
          for (const entity of result.delta.entities) deferred.keys.add(taskCurrentEntityKey(entity));
          deferredObservers.set(repairKey, deferred);
          receiverTiming.observerDeferredFrameCount += 1;
        } else {
          invokeObserver(frame.projectId, frame.from, result.delta);
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
        input.publish(frame.from, { type: 'state-converged', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, root, ...(active ? { attemptId: active.attemptId } : {}) } });
        // WHAT: Schedule final derived application work after structural convergence is published.
        // WHY: Content and UI invalidation must not delay the relay's exact-root settlement.
        if (active) queueDeferredObserver(repairKey, active.attemptId);
        clearActiveRepair(repairKey);
        terminalRepairAttempts.delete(repairKey);
        maybeScheduleObserverDrain();
        return;
      }
      const summaryIdentity = remoteRoot;
      const attemptId = `${remoteRoot}:${root}`;
      // WHAT: Suppress automatic repair for the relay root generation terminated by durable collision evidence.
      // WHY: Healthy entries can change the receiver root after a mixed ACK, while the poisoned relay cut remains unchanged.
      if (terminalRepairAttempts.get(repairKey) === summaryIdentity) return;
      // WHAT: Suppress an identical summary while its root generation remains unresolved.
      // WHY: Repeating the same missing request cannot make a permanently divergent peer progress.
      if (activeRepairRequests.get(repairKey)?.summaryIdentity === summaryIdentity) return;
      // WHAT: Admit one missing request for a newly observed peer root generation.
      // WHY: A changed peer state must remain eligible for normal epoch-4 convergence.
      if (missing.length > 0) {
        const published = input.publish(frame.from, {
          type: 'state-missing-request',
          projectId: frame.projectId,
          payload: { stateVersion: taskCurrentStateVersion, buckets: missing, attemptId, relayRoot: remoteRoot, receiverRoot: root },
        });
        // WHAT: Remember only a successfully published repair request.
        // WHY: Failed transport publication must remain eligible for reconnect reconciliation.
        if (published) armRepairDeadline(repairKey, summaryIdentity, attemptId, store);
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
      const rejected = Array.isArray(payload.rejected) ? payload.rejected.map(normalizeFederationStateRejection) : [];
      const relayRoot = String(payload.relayRoot ?? '');
      const disposition = new Map<string, string>();
      for (const acknowledgement of accepted) {
        const key = String(acknowledgement.key ?? '');
        const stateHash = String(acknowledgement.stateHash ?? '');
        // WHAT: Reject duplicate, unknown, and hash-mismatched accepted dispositions.
        // WHY: Delivery credit may be released only by an exact result for every submitted entity.
        if (disposition.has(key) || delivery.hashes.get(key) !== stateHash) throw new Error('invalid_state_acknowledgement');
        disposition.set(key, stateHash);
      }
      for (const rejection of rejected) {
        // WHAT: Reject duplicate, unknown, and hash-mismatched terminal dispositions.
        // WHY: A malformed collision result must retain the complete pending delivery for retry and diagnosis.
        if (disposition.has(rejection.key) || delivery.hashes.get(rejection.key) !== rejection.stateHash) throw new Error('invalid_state_acknowledgement');
        disposition.set(rejection.key, rejection.stateHash);
      }
      // WHAT: Require accepted and rejected results to cover the submitted delivery exactly once.
      // WHY: Partial settlement would silently discard unconfirmed causal state.
      if (disposition.size !== delivery.hashes.size) throw new Error('invalid_state_acknowledgement');
      // WHAT: Require the exact post-transaction relay root for every rejected publication.
      // WHY: Terminal suppression must bind to the relay generation that produced the collision.
      if (rejected.length > 0 && !/^[a-f0-9]{64}$/.test(relayRoot)) throw new Error('invalid_state_acknowledgement');
      const attemptId = rejected.length > 0 ? `publication:${deliveryId}` : '';
      const collisionRecords = rejected.length > 0
        ? await store.adoptPublicationCollisionEvidence({
          attemptId,
          deliveryId,
          rejected,
          submittedEntities: rejected.map((entry) => delivery.entities.get(entry.key)!),
        })
        : [];
      const dirty = runtimeDirty.get(frame.projectId);
      for (const acknowledgement of accepted) {
        const key = String(acknowledgement.key ?? '');
        const stateHash = String(acknowledgement.stateHash ?? '');
        if (delivery.hashes.get(key) === stateHash && dirty?.get(key)?.stateHash === stateHash) dirty.delete(key);
      }
      // WHAT: Retain a relay publication collision as terminal project repair evidence.
      // WHY: Reconnect must not automatically flood an entity that the relay durably rejected.
      if (rejected.length > 0) {
        terminalRepairAttempts.set(`relay\u0000${frame.projectId}`, relayRoot);
        const blocked = terminalPublicationHashes.get(frame.projectId) ?? new Map<string, string>();
        for (const rejection of rejected) blocked.set(rejection.key, rejection.stateHash);
        terminalPublicationHashes.set(frame.projectId, blocked);
        try { input.onRepairCollision?.({ projectId: frame.projectId, from: 'relay', attemptId, deliveryId, relayRoot, rejected, evidence: collisionRecords }); } catch {
          // Collision diagnostics cannot invalidate the relay's durable mixed disposition.
        }
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
      if (key.startsWith(`${peerId}\u0000`)) {
        const active = activeRepairRequests.get(key);
        if (active) queueDeferredObserver(key, active.attemptId);
        clearActiveRepair(key);
      }
    }
    for (const key of [...servedRepairRequests.keys()]) {
      // WHAT: Forget response suppression owned by the disconnected transport.
      // WHY: The replacement connection must be able to recover an unacknowledged transfer.
      if (key.startsWith(`${peerId}\u0000`)) servedRepairRequests.delete(key);
    }
    // WHAT: Retire relay delivery identities when the relay socket disconnects.
    // WHY: Their acknowledgements can never arrive, while runtimeDirty retains the durable retry authority.
    if (peerId === 'relay') pendingDeliveries.clear();
    maybeScheduleObserverDrain();
  };

  return {
    publishDelta,
    reconcileRelay,
    reconcileProject,
    handleFrame,
    disconnectPeer,
    // WHAT: Publish an explicit collision-recovery successor through the normal bounded relay lane.
    // WHY: A paused project still needs one authorized mutation to reach relay acknowledgement and root equality.
    publishRecoveryDelta: (delta: TaskStateDelta, store: TaskCurrentStateStore): void => {
      if (delta.entities.length === 0) return;
      const dirty = dirtyFor(delta.projectId);
      for (const entity of delta.entities) {
        const key = taskCurrentEntityKey(entity);
        dirty.set(key, entity);
        const blocked = terminalPublicationHashes.get(delta.projectId);
        // WHAT: Remove a stale publication block when explicit recovery creates a different causal hash.
        // WHY: Only the rejected hash is terminal; its validated successor must enter the normal relay lane.
        if (blocked?.get(key) !== entity.stateHash) blocked?.delete(key);
        if (blocked?.size === 0) terminalPublicationHashes.delete(delta.projectId);
      }
      enqueueRelayEntities(delta.projectId, delta.entities);
      flushRelayProject(delta.projectId, store);
    },
    restoreTerminalRepair: (projectId: string, from: string, attemptId: string, rejections: unknown[] = [], retainedRelayRoot = ''): void => {
      const relayRoot = retainedRelayRoot || (attemptId.split(':', 1)[0] ?? '');
      // WHAT: Restore the terminal relay generation from the relay root embedded in the durable attempt identity.
      // WHY: The receiver root changes after healthy entries merge, while the unchanged relay root remains the stable poisoned generation authority across restart.
      if (/^[a-f0-9]{64}$/.test(relayRoot)) terminalRepairAttempts.set(`${from}\u0000${projectId}`, relayRoot);
      // WHAT: Restore rejected publication hashes from the persisted incident context.
      // WHY: Reconnect must not republish the same terminal node-to-relay collision after process restart.
      if (attemptId.startsWith('publication:') && rejections.length > 0) {
        const blocked = new Map<string, string>();
        for (const value of rejections) {
          const rejection = normalizeFederationStateRejection(value);
          blocked.set(rejection.key, rejection.stateHash);
        }
        terminalPublicationHashes.set(projectId, blocked);
      }
    },
    clearTerminalRepair: (projectId: string, from = 'relay'): void => {
      terminalRepairAttempts.delete(`${from}\u0000${projectId}`);
      terminalPublicationHashes.delete(projectId);
    },
    diagnostics: () => ({
      convergence: [...convergence].map(([key, value]) => ({ peerId: key.split('\u0000')[0], ...value })),
      runtimeDirty: [...runtimeDirty].flatMap(([projectId, entities]) => [...entities].map(([entityKey, entity]) => ({ projectId, entityKey, stateHash: entity.stateHash }))),
      pendingDeliveryIds: [...pendingDeliveries.keys()],
      queuedRelayEntityCount: [...queuedRelayEntities.values()].reduce((count, entities) => count + entities.size, 0),
      activeRepairCount: activeRepairRequests.size,
      receiverTiming: { ...receiverTiming },
    }),
  };
}
