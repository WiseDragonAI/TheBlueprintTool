/**
 * WHAT: Delivers correlated, byte-bounded epoch-4 entity state and closes root repair loops.
 * WHY: Dirty state clears only after exact relay acknowledgement and synchronization requires equal roots.
 */
import { createHash, randomUUID } from 'node:crypto';
import { assertFederationRepairManifest, canonicalFederationRepairBuckets } from '../../../../../shared/federation-repair-guard.js';
import { federationMaximumStateFrameBytes, federationStateEntityBatchSize, type FederationStateRejection } from '../../../../../shared/federation-state-transport.js';
import { dotKey, taskCurrentEntityKey } from '../../../../../shared/task-current-state-core.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import { taskCurrentStateVersion, type TaskCurrentBucket, type TaskCurrentEntity, type TaskEntityChange, type TaskStateDelta } from '../../task-state/helper/task-current-state-types.js';
import type { FederationStateFrame } from './federation-node-connector.js';

type Publisher = (peerId: string, frame: Omit<FederationStateFrame, 'from'>) => boolean;
type StateEnvelope = { key: string; stateHash: string; entity: TaskCurrentEntity };
type PendingDelivery = { projectId: string; hashes: Map<string, string> };
type PausedRepair = { peerRoot: string; rejected: FederationStateRejection[] };
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

export function firstBoundedStateFrame(projectId: string, entities: readonly TaskCurrentEntity[]): { deliveryId: string; entries: StateEnvelope[] } | null {
  const deliveryId = randomUUID();
  let entries: StateEnvelope[] = [];
  for (const entity of entities) {
    const entry = { key: taskCurrentEntityKey(entity), stateHash: entity.stateHash, entity };
    const candidate = [...entries, entry];
    const bytes = encoder.encode(JSON.stringify({ version: 1, type: 'state-entity-batch', stateVersion: taskCurrentStateVersion, projectId, payload: { stateVersion: taskCurrentStateVersion, deliveryId, entries: candidate } })).byteLength;
    // WHAT: Return the admitted prefix before the next entity crosses the shared count or byte ceiling.
    // WHY: Relay publication sends only one frame per acknowledgement and must not serialize or partition the unsent tail.
    if (entries.length > 0 && (candidate.length > federationStateEntityBatchSize || bytes > federationMaximumStateFrameBytes)) return { deliveryId, entries };
    // WHAT: Reject one entity that cannot fit in an otherwise empty shared frame.
    // WHY: No later partition can make an individually oversized entity admissible.
    if (bytes > federationMaximumStateFrameBytes) throw new Error('state_frame_too_large');
    entries = candidate;
    // WHAT: Return immediately at the exact shared count boundary.
    // WHY: Inspecting entity seventeen would perform work owned by the next relay acknowledgement.
    if (entries.length === federationStateEntityBatchSize) return { deliveryId, entries };
  }
  return entries.length > 0 ? { deliveryId, entries } : null;
}

export function createFederationTaskStateReplicator(input: {
  stores: () => Map<string, TaskCurrentStateStore>;
  storeFor?: (projectId: string, ownerNodeId: string) => TaskCurrentStateStore | null;
  publish: Publisher;
  onProjectionChange?: (input: { projectId: string; from: string; delta: TaskStateDelta }) => void;
  onProjectionError?: (input: { projectId: string; from: string; error: unknown }) => void;
  onTerminalRejection?: (input: { projectId: string; from: string; peerRoot: string; rejected: FederationStateRejection[] }) => void;
  onRepairDeadline?: (input: { projectId: string; from: string; peerRoot: string }) => void;
  repairDeadlineMs?: number;
}) {
  const convergence = new Map<string, { projectId: string; converged: boolean; lastRepairAt: string; missingBuckets: string[]; root: string }>();
  const runtimeDirty = new Map<string, Map<string, TaskCurrentEntity>>();
  const pendingDeliveries = new Map<string, PendingDelivery>();
  const queuedRelayEntities = new Map<string, Map<string, TaskCurrentEntity>>();
  const activeRepairRequests = new Map<string, string>();
  const servedRepairRequests = new Map<string, { root: string; buckets: Set<string> }>();
  const pausedRepairs = new Map<string, PausedRepair>();
  const peerRoots = new Map<string, string>();
  const repairDeadlines = new Map<string, NodeJS.Timeout>();
  const collisionRecoveryProjects = new Set<string>();
  const repairDeadlineMs = input.repairDeadlineMs ?? 30_000;
  const collisionRecoveryIdentity = (rejected: FederationStateRejection[]): string => `federation-collision-recovery-${createHash('sha256').update(JSON.stringify(rejected)).digest('hex').slice(0, 32)}`;

  const validCollisionEvidence = (rejected: FederationStateRejection[]): boolean => {
    const keys = new Set<string>();
    return rejected.length > 0 && rejected.every((entry) => {
      const collisions = entry.collisions ?? [];
      const coordinates = collisions.map((collision) => `${collision.path}\u0000${collision.replicaId}\u0000${collision.counter}`);
      const canonical = [...coordinates].sort();
      const valid = entry.code === 'task_current_dot_collision'
        && /^[a-f0-9]{64}$/.test(entry.stateHash)
        && /^[a-f0-9]{64}$/.test(entry.relayStateHash ?? '')
        && !keys.has(entry.key)
        && collisions.length > 0
        && collisions.every((collision) => Boolean(collision.path) && Boolean(collision.replicaId) && Number.isSafeInteger(collision.counter) && collision.counter > 0)
        && coordinates.length === new Set(coordinates).size
        && JSON.stringify(coordinates) === JSON.stringify(canonical);
      keys.add(entry.key);
      return valid;
    });
  };

  const isCollisionRecoverySuccessor = (entity: TaskCurrentEntity, rejection: FederationStateRejection, recoveryIdentity: string): boolean => (
    (rejection.collisions ?? []).length > 0 && (rejection.collisions ?? []).every((collision) => {
      const register = entity.fields[collision.path];
      return (register?.clock[collision.replicaId] ?? 0) >= collision.counter
        && register.candidates.some((candidate) => candidate.dot.replicaId === recoveryIdentity && candidate.dot.counter === 1);
    })
  );

  const clearRepairDeadline = (repairKey: string): void => {
    const timer = repairDeadlines.get(repairKey);
    // WHAT: Clear only the exact repair deadline that reached a terminal boundary.
    // WHY: Timers must not survive convergence, terminal pause, or server close.
    if (timer) clearTimeout(timer);
    repairDeadlines.delete(repairKey);
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
      if (published && peerId === 'relay') pendingDeliveries.set(frame.deliveryId, { projectId, hashes: new Map(frame.entries.map((entry) => [entry.key, entry.stateHash])) });
    }
    return sent;
  };

  const publishRelayBatch = (projectId: string, entities: TaskCurrentEntity[]): boolean => {
    const frame = firstBoundedStateFrame(projectId, entities);
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
    // WHAT: Keep a terminally rejected project outside automatic relay publication.
    // WHY: Reconnect and ordinary reconciliation cannot resolve a same-dot different-value collision.
    if (pausedRepairs.has(projectId) && !collisionRecoveryProjects.has(projectId)) return;
    // WHAT: Keep the current project batch group in flight until every relay acknowledgement settles.
    // WHY: Publishing a second group before the first settles creates intermediate roots and duplicate repair rounds.
    if (hasPendingRelayDelivery(projectId)) return;
    const queued = queuedRelayEntities.get(projectId);
    // WHAT: Advertise the project root only when no entity batch remains queued.
    // WHY: A root emitted before the final batch is an intermediate state that falsely starts another repair.
    if (!queued?.size) {
      queuedRelayEntities.delete(projectId);
      advertise('relay', projectId, store);
      collisionRecoveryProjects.delete(projectId);
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
      // WHAT: Preserve dirty state without requeueing a project whose terminal collision awaits explicit recovery.
      // WHY: Reconnect must perform zero repeated delivery work for an unchanged rejected entity.
      if (pausedRepairs.has(projectId)) continue;
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
      // WHAT: Preserve remote-project dirty state without retrying a terminal collision.
      // WHY: Project ownership does not make a same-dot rejection transient.
      if (pausedRepairs.has(projectId)) continue;
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
      peerRoots.set(repairKey, remoteRoot);
      convergence.set(repairKey, { projectId: frame.projectId, converged, lastRepairAt: new Date().toISOString(), missingBuckets: missing, root });
      // WHAT: Settle the active repair when this summary proves exact local and peer root equality.
      // WHY: In node-behind-relay repair the node emits convergence; it does not wait to receive it.
      if (converged) {
        activeRepairRequests.delete(repairKey);
        clearRepairDeadline(repairKey);
        input.publish(frame.from, { type: 'state-converged', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, root } });
        return;
      }
      // WHAT: Observe the peer root without opening a new missing-request loop for a terminally rejected project.
      // WHY: Only explicit validated recovery may clear the collision pause.
      if (frame.from === 'relay' && pausedRepairs.has(frame.projectId)) {
        const paused = pausedRepairs.get(frame.projectId)!;
        const changedDeadlineRepair = paused.rejected.length === 0 && remoteRoot !== paused.peerRoot;
        // WHAT: Admit one new non-terminal repair identity when relay authority changes after a no-progress deadline.
        // WHY: A deadline contains one unchanged divergence; it must not permanently suppress genuinely new relay state.
        if (changedDeadlineRepair) {
          paused.peerRoot = remoteRoot;
          activeRepairRequests.delete(repairKey);
          clearRepairDeadline(repairKey);
        } else {
          // WHAT: Keep an unchanged deadline pause and every terminal collision outside automatic repair.
          // WHY: Reconnect and unrelated relay generations cannot repair a same-dot conflict or unchanged divergence.
          return;
        }
      }
      const repairIdentity = `${remoteRoot}\u0000${manifestDigest}`;
      // WHAT: Suppress an identical summary while its root generation remains unresolved.
      // WHY: Repeating the same missing request cannot make a permanently divergent peer progress.
      if (activeRepairRequests.get(repairKey) === repairIdentity) return;
      // WHAT: Retire an earlier root's deadline before admitting changed peer state.
      // WHY: The replacement repair identity requires its own complete bounded observation window.
      if (activeRepairRequests.has(repairKey)) clearRepairDeadline(repairKey);
      // WHAT: Admit one missing request for a newly observed peer root and manifest.
      // WHY: A changed peer state must remain eligible for normal epoch-4 convergence.
      if (missing.length > 0) {
        const published = input.publish(frame.from, { type: 'state-missing-request', projectId: frame.projectId, payload: { stateVersion: taskCurrentStateVersion, buckets: missing } });
        // WHAT: Remember only a successfully published repair request.
        // WHY: Failed transport publication must remain eligible for reconnect reconciliation.
        if (published) {
          activeRepairRequests.set(repairKey, repairIdentity);
          // WHAT: Arm one bounded terminal deadline without scheduling any retry.
          // WHY: Permanently divergent repair must settle into the existing incident boundary instead of remaining active forever.
          if (!repairDeadlines.has(repairKey)) {
            const timer = setTimeout(() => {
              repairDeadlines.delete(repairKey);
              // WHAT: Pause only the still-active exact repair identity at deadline.
              // WHY: A changed or converged repair must not inherit an obsolete timer's terminal result.
              if (activeRepairRequests.get(repairKey) !== repairIdentity) return;
              activeRepairRequests.delete(repairKey);
              pausedRepairs.set(frame.projectId, { peerRoot: remoteRoot, rejected: [] });
              try { input.onRepairDeadline?.({ projectId: frame.projectId, from: frame.from, peerRoot: remoteRoot }); } catch {
                // Diagnostics must not escape the terminal deadline boundary.
              }
            }, repairDeadlineMs);
            timer.unref?.();
            repairDeadlines.set(repairKey, timer);
          }
        }
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

    if (frame.type === 'state-converged') {
      const repairKey = `${frame.from}\u0000${frame.projectId}`;
      // WHAT: Settle the exact active timer only when the peer confirms receiver application at the local root.
      // WHY: Socket send and acknowledgements alone do not prove end-to-end convergence.
      if (String(payload.root ?? '') === store.rootHash()) {
        activeRepairRequests.delete(repairKey);
        clearRepairDeadline(repairKey);
      }
      return;
    }

    if (frame.type === 'state-relay-ack') {
      const deliveryId = String(payload.deliveryId ?? '');
      const delivery = pendingDeliveries.get(deliveryId);
      if (!delivery || delivery.projectId !== frame.projectId) return;
      const accepted = Array.isArray(payload.accepted) ? payload.accepted as Array<{ key?: string; stateHash?: string }> : [];
      const wireRejected = Array.isArray(payload.rejected) ? payload.rejected as Array<{ key?: unknown; stateHash?: unknown; relayStateHash?: unknown; collisions?: unknown; code?: unknown }> : [];
      const rejected = wireRejected.flatMap((entry): FederationStateRejection[] => {
        const key = String(entry.key ?? '');
        const stateHash = String(entry.stateHash ?? '');
        const relayStateHash = String(entry.relayStateHash ?? '');
        const collisions = Array.isArray(entry.collisions) ? entry.collisions.flatMap((collision): Array<{ path: string; replicaId: string; counter: number }> => {
          const value = collision && typeof collision === 'object' ? collision as Record<string, unknown> : {};
          const path = String(value.path ?? '');
          const replicaId = String(value.replicaId ?? '');
          const counter = Number(value.counter);
          // WHAT: Admit only complete structured collision coordinates from the correlated relay acknowledgement.
          // WHY: Recovery cannot safely construct a dominating successor from malformed or partial evidence.
          if (!path || !replicaId || !Number.isSafeInteger(counter) || counter < 1) return [];
          return [{ path, replicaId, counter }];
        }) : [];
        const code = String(entry.code ?? '');
        // WHAT: Admit only a correlated terminal rejection owned by this exact delivery.
        // WHY: An uncorrelated acknowledgement must not pause unrelated durable project state.
        if (code !== 'task_current_dot_collision' || delivery.hashes.get(key) !== stateHash || !/^[a-f0-9]{64}$/.test(relayStateHash) || collisions.length === 0) return [];
        return [{ key, stateHash, relayStateHash, collisions, code }];
      });
      const dirty = runtimeDirty.get(frame.projectId);
      for (const acknowledgement of accepted) {
        const key = String(acknowledgement.key ?? '');
        const stateHash = String(acknowledgement.stateHash ?? '');
        if (delivery.hashes.get(key) === stateHash && dirty?.get(key)?.stateHash === stateHash) dirty.delete(key);
      }
      pendingDeliveries.delete(deliveryId);
      if (dirty?.size === 0) runtimeDirty.delete(frame.projectId);
      // WHAT: Settle the transport delivery and pause automatic relay work after a correlated terminal rejection.
      // WHY: Local durable state remains authoritative while retries across reconnects would reproduce the same collision forever.
      if (rejected.length > 0) {
        clearRepairDeadline(`relay\u0000${frame.projectId}`);
        pausedRepairs.set(frame.projectId, {
          peerRoot: peerRoots.get(`relay\u0000${frame.projectId}`) ?? '',
          rejected,
        });
        collisionRecoveryProjects.delete(frame.projectId);
        queuedRelayEntities.delete(frame.projectId);
        activeRepairRequests.delete(`relay\u0000${frame.projectId}`);
        try { input.onTerminalRejection?.({ projectId: frame.projectId, from: frame.from, peerRoot: pausedRepairs.get(frame.projectId)!.peerRoot, rejected }); } catch {
          // Diagnostics must not escape the terminal rejection boundary.
        }
      }
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

  const validateProjectRepairResume = (projectId: string): boolean => {
    const paused = pausedRepairs.get(projectId);
    const store = input.stores().get(projectId);
    const relayRoot = peerRoots.get(`relay\u0000${projectId}`);
    const retained = new Map((store?.activeDelta(paused?.rejected.map((entry) => entry.key)).entities ?? [])
      .map((entity) => [taskCurrentEntityKey(entity), entity]));
    // WHAT: Reject resume until the stored rejection, preserved local entity, and observed relay root all validate.
    // WHY: Clearing the pause before a causally joined successor reaches equal root would restart the irreconcilable delivery loop.
    if (!paused || !store || !validCollisionEvidence(paused.rejected) || relayRoot !== store.rootHash()
      || paused.rejected.some((entry) => {
        const entity = retained.get(entry.key);
        return !entity || (entity.stateHash !== entry.stateHash && !isCollisionRecoverySuccessor(entity, entry, collisionRecoveryIdentity(paused.rejected)));
      })) return false;
    return true;
  };

  const restorePausedProjectRepair = (projectId: string, evidence: { peerRoot: string; rejected: FederationStateRejection[] }): boolean => {
    const store = input.stores().get(projectId);
    const rejected = evidence.rejected;
    const keys = new Set(rejected.map((entry) => entry.key));
    const retained = store?.activeDelta([...keys]).entities ?? [];
    const byKey = new Map(retained.map((entity) => [taskCurrentEntityKey(entity), entity]));
    // WHAT: Restore a restart-surviving pause only from valid incident evidence that still names the exact local entities.
    // WHY: Explicit recovery must not trust changed incident context or silently replace the preserved causal state.
    const recoveryIdentity = collisionRecoveryIdentity(rejected);
    if (!store || !validCollisionEvidence(rejected) || rejected.some((entry) => {
      const entity = byKey.get(entry.key);
      return !entity || (entity.stateHash !== entry.stateHash && !isCollisionRecoverySuccessor(entity, entry, recoveryIdentity));
    })) return false;
    const dirty = dirtyFor(projectId);
    for (const entity of retained) dirty.set(taskCurrentEntityKey(entity), entity);
    pausedRepairs.set(projectId, { peerRoot: evidence.peerRoot, rejected: rejected.map((entry) => ({ ...entry })) });
    queuedRelayEntities.delete(projectId);
    return true;
  };

  const holdProjectRepair = (projectId: string, peerRoot: string): void => {
    pausedRepairs.set(projectId, { peerRoot, rejected: [] });
    queuedRelayEntities.delete(projectId);
  };

  const resolveProjectCollisionLocalWins = async (projectId: string): Promise<boolean> => {
    const paused = pausedRepairs.get(projectId);
    const store = input.stores().get(projectId);
    // WHAT: Admit collision recovery only for an explicitly paused locally authoritative project.
    // WHY: A federated replica returned by storeFor cannot overwrite the owning project's authority.
    if (!paused || !store || !validCollisionEvidence(paused.rejected)) return false;
    const recoveryIdentity = collisionRecoveryIdentity(paused.rejected);
    const existingSuccessors = paused.rejected.map((entry) => store.activeDelta([entry.key]).entities[0]).filter((entity, index) => entity && isCollisionRecoverySuccessor(entity, paused.rejected[index], recoveryIdentity));
    // WHAT: Republish an already durable deterministic successor without creating another mutation.
    // WHY: Restart and repeated operator recovery must preserve the original recovery dot.
    if (existingSuccessors.length === paused.rejected.length) {
      const dirty = dirtyFor(projectId);
      for (const entity of existingSuccessors) dirty.set(taskCurrentEntityKey(entity), entity);
      enqueueRelayEntities(projectId, existingSuccessors);
      collisionRecoveryProjects.add(projectId);
      flushRelayProject(projectId, store);
      return true;
    }
    // WHAT: Reject a mix of unresolved evidence and already-created successors.
    // WHY: One operator recovery must create one atomic causal transition for the complete incident.
    if (existingSuccessors.length > 0) return false;
    const changesByEntity = new Map<string, TaskEntityChange>();
    for (const rejection of paused.rejected) {
      const entity = store.activeDelta([rejection.key]).entities[0];
      // WHAT: Refuse stale evidence that no longer identifies the rejected local entity.
      // WHY: Recovery must reassert preserved authority rather than silently select changed state.
      if (!entity) return false;
      // WHAT: Refuse stale evidence that names neither the rejected entity nor its deterministic successor.
      // WHY: Changed local authority cannot be silently overwritten during recovery.
      if (entity.stateHash !== rejection.stateHash) return false;
      const grouped = { entityType: entity.entityType, entityId: entity.entityId, changes: [] } satisfies TaskEntityChange;
      for (const path of [...new Set(rejection.collisions!.map((collision) => collision.path))].sort()) {
        const register = entity.fields[path];
        const pathCollisions = rejection.collisions!.filter((collision) => collision.path === path);
        const coordinatesPresent = pathCollisions.every((collision) => register?.candidates.some((candidate) => candidate.dot.replicaId === collision.replicaId && candidate.dot.counter === collision.counter));
        // WHAT: Refuse a path whose exact collided local dots are not all preserved.
        // WHY: Recovery cannot claim to dominate evidence absent from local authority.
        if (!register || !coordinatesPresent) return false;
        const candidate = [...register.candidates].sort((left, right) => dotKey(left.dot).localeCompare(dotKey(right.dot)))[0];
        // WHAT: Select exactly the same first-dot candidate used by materialized projection semantics.
        // WHY: Multiple collided dots on one path must produce one deterministic fresh candidate, not a self-collision.
        if (!candidate) return false;
        grouped.changes.push({ path, operation: candidate.operation, ...(Object.hasOwn(candidate, 'value') ? { value: candidate.value } : {}) });
      }
      changesByEntity.set(rejection.key, grouped);
    }
    const mutation = await store.mutate({ replicaId: recoveryIdentity, changes: [...changesByEntity.values()] });
    const dirty = dirtyFor(projectId);
    for (const entity of mutation.delta.entities) dirty.set(taskCurrentEntityKey(entity), entity);
    enqueueRelayEntities(projectId, mutation.delta.entities);
    collisionRecoveryProjects.add(projectId);
    flushRelayProject(projectId, store);
    return true;
  };

  const resumeProjectRepair = (projectId: string): boolean => {
    // WHAT: Mutate the paused repair only after the caller has passed the shared validation boundary.
    // WHY: Runtime recovery must install and validate replacement state before reopening relay publication.
    if (!validateProjectRepairResume(projectId)) return false;
    const store = input.stores().get(projectId);
    const dirty = runtimeDirty.get(projectId);
    pausedRepairs.delete(projectId);
    collisionRecoveryProjects.delete(projectId);
    activeRepairRequests.delete(`relay\u0000${projectId}`);
    enqueueRelayEntities(projectId, [...(dirty?.values() ?? [])]);
    flushRelayProject(projectId, store!);
    return true;
  };

  const close = (): void => {
    for (const repairKey of [...repairDeadlines.keys()]) clearRepairDeadline(repairKey);
  };

  return {
    publishDelta,
    reconcileRelay,
    reconcileProject,
    handleFrame,
    disconnectPeer,
    close,
    hasPausedProjectRepair: (projectId: string) => pausedRepairs.has(projectId),
    holdProjectRepair,
    restorePausedProjectRepair,
    validateProjectRepairResume,
    resolveProjectCollisionLocalWins,
    resumeProjectRepair,
    diagnostics: () => ({
      convergence: [...convergence].map(([key, value]) => ({ peerId: key.split('\u0000')[0], ...value })),
      runtimeDirty: [...runtimeDirty].flatMap(([projectId, entities]) => [...entities].map(([entityKey, entity]) => ({ projectId, entityKey, stateHash: entity.stateHash }))),
      pendingDeliveryIds: [...pendingDeliveries.keys()],
      queuedRelayEntityCount: [...queuedRelayEntities.values()].reduce((count, entities) => count + entities.size, 0),
      activeRepairCount: activeRepairRequests.size,
      pausedRepairs: [...pausedRepairs].map(([projectId, paused]) => ({ projectId, ...paused })),
      repairDeadlineCount: repairDeadlines.size,
    }),
  };
}
