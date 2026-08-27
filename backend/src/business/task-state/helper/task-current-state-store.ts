/**
 * WHAT: Persists epoch-4 causal state through journals, independent shards, and local publication markers.
 * WHY: Local success must follow journal durability while replicated hashes contain only joinable domain state.
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import {
  hashTaskCurrentBucket,
  hashTaskCurrentRoot,
  taskCurrentDotCollisionCoordinates,
  taskCurrentBucketForEntityKey,
  taskCurrentEntityKey,
} from '../../../../../shared/task-current-state-core.js';
import { assertTaskCurrentEntity, finalizeTaskCurrentEntity, joinTaskClocks, joinTaskEntities } from './task-current-state-join.js';
import { canonicalizeTaskProjectionClock, materializeTaskCurrentEntity, projectedTaskCurrentEntity } from './materialize-task-current-entity.js';
import { runBoundedTaskMaterialization } from './run-bounded-task-materialization.js';
import { createTaskLocalPublicationState } from './task-local-publication-state.js';
import { taskCurrentBaselineChanges } from './task-current-state-baseline.js';
import { taskCurrentStateDiagnostics } from './task-current-state-diagnostics.js';
import { createTaskCurrentStatePersistence } from './task-current-state-persistence.js';
import {
  createTaskStateBootstrapReceipt,
  encodeTaskStateCheckpoint,
  encodeTaskStateGeneration,
  readTaskStateCheckpoint,
  taskStateCheckpointWitness,
  validateTaskStateBootstrapReceipt,
  type LegacyTaskStateCheckpointPayload,
  type TaskStateBootstrapReceipt,
  type TaskStateCheckpointPayload,
} from './task-current-state-checkpoint.js';
import {
  taskCurrentBaselineEpoch,
  taskCurrentStateVersion,
  taskEntityTypes,
  taskStateProtocol,
  type TaskCausalClock,
  type TaskCurrentBucket,
  type TaskCurrentEntity,
  type TaskCurrentFormat,
  type TaskCurrentProjection,
  type TaskEntityChange,
  type TaskMutationBatch,
  type TaskRepairCollisionEvidence,
  type TaskRepairCollisionRejection,
  type TaskRepairCollisionRecoveryReceipt,
  type TaskStateDelta,
} from './task-current-state-types.js';

type JournalDocument = { version: typeof taskCurrentStateVersion; mutation?: TaskMutationBatch; delta?: TaskStateDelta; activateTaskId?: string; repairCollisions?: TaskRepairCollisionEvidence[]; repairRecovery?: TaskRepairCollisionRecoveryReceipt };
type RepairDelivery = { attemptId: string; deliveryId: string; delta: TaskStateDelta };
type RepairAcceptedEntry = { key: string; stateHash: string; receiverStateHash: string; changed: boolean };
type RepairDeliveryResult = { attemptId: string; deliveryId: string; accepted: RepairAcceptedEntry[]; rejected: TaskRepairCollisionRejection[] };
const repairWalMagic = Buffer.from('DOSTSWAL');
const repairWalHeaderBytes = repairWalMagic.length + 1 + 4 + 4 + 32;
const repairWalCommit = 0xa5;
const maximumRepairWalPayloadBytes = 16 * 1024 * 1024;
type StoreOptions = {
  decisionOsRoot: string;
  projectId: string;
  bootstrapReceipt?: TaskStateBootstrapReceipt;
  initializeLedger?: Record<string, unknown>;
  initializeReplica?: { replicaId: string; counter: number };
  deferFormat?: boolean;
  forceCanonicalValidation?: boolean;
  onPersistenceError?: (error: Error) => void;
};

function assertRepairCollisionEvidence(evidence: TaskRepairCollisionEvidence): void {
  if (evidence.version !== taskCurrentStateVersion || evidence.code !== 'task_current_dot_collision'
    || !evidence.projectId || !evidence.attemptId || !evidence.deliveryId || !Number.isFinite(Date.parse(evidence.recordedAt))
    || !/^[a-f0-9]{64}$/.test(evidence.stateHash) || !/^[a-f0-9]{64}$/.test(evidence.receiverStateHash)) {
    throw new Error('invalid_task_current_repair_collision_evidence');
  }
  // WHAT: Reject persisted collision directions outside the legacy receiver lane and the additive publication lane.
  // WHY: Corrupt durable evidence must fail closed instead of inheriting the legacy hash orientation.
  if (evidence.direction !== undefined && evidence.direction !== 'publication') {
    throw new Error('invalid_task_current_repair_collision_evidence');
  }
  assertTaskCurrentEntity(evidence.localEntity);
  assertTaskCurrentEntity(evidence.remoteEntity);
  if (evidence.key !== taskCurrentEntityKey(evidence.remoteEntity)
    || evidence.key !== taskCurrentEntityKey(evidence.localEntity)
    || (evidence.direction === 'publication'
      ? evidence.stateHash !== evidence.localEntity.stateHash || evidence.receiverStateHash !== evidence.remoteEntity.stateHash
      : evidence.stateHash !== evidence.remoteEntity.stateHash || evidence.receiverStateHash !== evidence.localEntity.stateHash)
    || evidence.projectId !== evidence.localEntity.projectId
    || evidence.projectId !== evidence.remoteEntity.projectId
    || evidence.collisions.length < 1) throw new Error('invalid_task_current_repair_collision_evidence');
  const normalized = [...evidence.collisions].sort((left, right) => `${left.entityType}\u0000${left.entityId}\u0000${left.path}\u0000${left.dot.replicaId}\u0000${left.dot.counter}`
    .localeCompare(`${right.entityType}\u0000${right.entityId}\u0000${right.path}\u0000${right.dot.replicaId}\u0000${right.dot.counter}`));
  if (JSON.stringify(normalized) !== JSON.stringify(evidence.collisions)) throw new Error('invalid_task_current_repair_collision_evidence');
}

function assertRepairRecoveryReceipt(receipt: TaskRepairCollisionRecoveryReceipt): void {
  if (receipt.version !== taskCurrentStateVersion || !receipt.projectId || !receipt.attemptId
    || !/^[a-f0-9]{64}$/.test(receipt.evidenceHash) || !receipt.replicaId || !receipt.batchId
    || Object.values(receipt.resultingStateHashes).some((hash) => !/^[a-f0-9]{64}$/.test(hash))) {
    throw new Error('invalid_task_current_repair_recovery_receipt');
  }
}

async function validateRetainedExecutionArtifacts(objectRoot: string, value: unknown): Promise<void> {
  // WHAT: Reject a non-object artifacts candidate before granting local recovery authority.
  // WHY: Collision recovery may reassert only the exact execution artifact manifest already admitted by epoch 4.
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('task_current_repair_artifacts_invalid');
  const artifacts = value as Record<string, unknown>;
  for (const kind of ['jsonl', 'stderr', 'telemetry', 'result']) {
    const candidate = artifacts[kind];
    // WHAT: Accept an explicitly absent optional artifact without filesystem work.
    // WHY: Epoch-4 execution manifests represent unavailable optional artifacts as null.
    if (candidate === null) continue;
    // WHAT: Reject a malformed retained artifact head before resolving its immutable object path.
    // WHY: Operator recovery cannot transform incomplete metadata into local authority.
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error(`task_current_repair_artifact_invalid:${kind}`);
    const head = candidate as Record<string, unknown>;
    const hash = String(head.hash ?? '');
    const expectedBytes = Number(head.bytes ?? -1);
    // WHAT: Reject noncanonical object coordinates before reading project storage.
    // WHY: The recovery gate must remain confined to the project's hash-addressed object namespace.
    if (!/^[a-f0-9]{64}$/.test(hash) || !Number.isSafeInteger(expectedBytes) || expectedBytes < 0) throw new Error(`task_current_repair_artifact_invalid:${kind}`);
    const file = resolve(objectRoot, hash.slice(0, 2), hash);
    const digest = createHash('sha256');
    let observedBytes = 0;
    try {
      for await (const chunk of createReadStream(file, { highWaterMark: 256 * 1024 })) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        digest.update(buffer);
        observedBytes += buffer.byteLength;
      }
    } catch {
      throw new Error(`task_current_repair_artifact_missing:${kind}:${hash}`);
    }
    // WHAT: Reject a retained object whose bytes no longer match the selected local manifest.
    // WHY: A causally dominant successor must not authorize missing or changed execution evidence.
    if (observedBytes !== expectedBytes || digest.digest('hex') !== hash) throw new Error(`task_current_repair_artifact_mismatch:${kind}:${hash}`);
  }
}

function emptyProjection(projectId: string): TaskCurrentProjection {
  return { version: taskCurrentStateVersion, projectId, ledger: { cards: [], annotations: [], relationships: [] }, conflicts: [], clock: {} };
}

function registerContext(batch: TaskMutationBatch, current: TaskCurrentEntity | undefined, path: string): TaskCausalClock {
  const observed = current?.fields[path]?.clock ?? {};
  const relevant = Object.fromEntries(Object.entries(observed).flatMap(([replicaId, counter]) => {
    const observedCounter = batch.context[replicaId];
    return observedCounter === undefined ? [] : [[replicaId, Math.min(counter, observedCounter)]];
  }));
  return joinTaskClocks(relevant, { [batch.dot.replicaId]: batch.dot.counter });
}

function registerEntity(batch: TaskMutationBatch, change: TaskEntityChange, current?: TaskCurrentEntity): TaskCurrentEntity {
  const changes = change.changes.some((field) => field.path === '$entity')
    ? change.changes
    : [{ path: '$entity', operation: 'set' as const, value: true }, ...change.changes];
  return finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId: batch.projectId,
    entityType: change.entityType,
    entityId: change.entityId,
    fields: Object.fromEntries(changes.map((field) => [field.path, {
      clock: registerContext(batch, current, field.path),
      candidates: [{ dot: batch.dot, operation: field.operation, ...(Object.hasOwn(field, 'value') ? { value: structuredClone(field.value) } : {}) }],
    }])),
  });
}

export function createTaskCurrentStateStore(options: StoreOptions) {
  const root = resolve(options.decisionOsRoot, 'task-state', options.projectId);
  const formatFile = resolve(root, 'format.json');
  const journalDirectory = resolve(root, 'journal');
  const heldDirectory = resolve(root, 'local', 'held');
  const currentDirectory = resolve(root, 'current');
  const checkpointFile = resolve(root, 'cache', 'checkpoint.json');
  const generationFile = resolve(root, 'generation.json');
  const entities = new Map<string, TaskCurrentEntity>();
  const publication = createTaskLocalPublicationState(heldDirectory);
  const bucketEntries = new Map<string, Map<string, TaskCurrentEntity>>();
  const bucketSummaries = new Map<string, TaskCurrentBucket>();
  const projection = emptyProjection(options.projectId);
  const pendingEntities = new Map<string, TaskCurrentEntity>();
  const pendingJournals = new Set<string>();
  const retainedCollisionEvidence = new Map<string, TaskRepairCollisionEvidence>();
  const collisionRecoveryReceipts = new Map<string, TaskRepairCollisionRecoveryReceipt>();
  const persistence = createTaskCurrentStatePersistence(root);
  let clock: TaskCausalClock = {};
  let materializer: Promise<void> | null = null;
  let materializerError: Error | null = null;
  let transitionTail = Promise.resolve();
  let deferBucketSummaries = false;
  let checkpointStatus: 'missing' | 'warm' | 'invalid' | 'cold' = 'missing';
  let checkpointError = '';
  let checkpointWritesDisabled = options.deferFormat === true;
  let checkpointReadCount = 0;
  let shardReadCount = 0;
  let markerReadCount = 0;
  let projectionMaterializationCount = 0;
  let checkpointGeneration = '';
  let checkpointSnapshotCurrent = false;
  let currentBootstrapReceipt: TaskStateBootstrapReceipt | null = null;
  let generationTail = Promise.resolve();
  const checkpointPaths = { current: currentDirectory, held: heldDirectory, journal: journalDirectory };
  // WHAT: Recognize only canonical mutation journals and repair WALs as retained recovery evidence.
  // WHY: An abandoned atomic-write temp artifact is not replayable authority and must not disable restart checkpoints forever.
  const hasRetainedJournalEvidence = (): boolean => existsSync(journalDirectory)
    && readdirSync(journalDirectory).some((name) => name.endsWith('.json') || name.endsWith('.wal'));
  const mergeTiming = { count: 0, entities: 0, prepareMs: 0, journalMs: 0, journalEncodeMs: 0, journalOpenMs: 0, journalQueueWaitMs: 0, journalWriteMs: 0, journalFileSyncMs: 0, journalRenameMs: 0, journalDirectorySyncMs: 0, installMs: 0, resultCloneMs: 0 };

  const serializeTransition = <Result>(operation: () => Promise<Result>): Promise<Result> => {
    const result = transitionTail.then(operation);
    transitionTail = result.then(() => undefined, () => undefined);
    return result;
  };

  const updateBucket = (key: string, entity: TaskCurrentEntity): void => {
    const bucket = taskCurrentBucketForEntityKey(key);
    const entries = bucketEntries.get(bucket) ?? new Map<string, TaskCurrentEntity>();
    if (publication.isHeld(key)) entries.delete(key);
    else entries.set(key, entity);
    if (entries.size === 0) {
      bucketEntries.delete(bucket);
      bucketSummaries.delete(bucket);
      return;
    }
    bucketEntries.set(bucket, entries);
    if (deferBucketSummaries) return;
    bucketSummaries.set(bucket, { bucket, count: entries.size, checksum: hashTaskCurrentBucket(entries) });
  };

  const rebuildBucketSummaries = (): void => {
    bucketSummaries.clear();
    for (const [bucket, entries] of bucketEntries) {
      bucketSummaries.set(bucket, { bucket, count: entries.size, checksum: hashTaskCurrentBucket(entries) });
    }
  };

  const applyEntity = (incoming: TaskCurrentEntity, takeOwnership = false, deferProjectionClockCanonicalization = false): boolean => {
    if (incoming.projectId !== options.projectId) throw new Error('task_current_project_mismatch');
    const key = taskCurrentEntityKey(incoming);
    const current = entities.get(key);
    let joined: TaskCurrentEntity;
    if (current) joined = joinTaskEntities(current, incoming);
    else if (takeOwnership) {
      assertTaskCurrentEntity(incoming);
      joined = incoming;
    } else joined = joinTaskEntities(undefined, incoming);
    return installJoinedEntity(joined, deferProjectionClockCanonicalization);
  };

  const installJoinedEntity = (joined: TaskCurrentEntity, deferProjectionClockCanonicalization = false): boolean => {
    const key = taskCurrentEntityKey(joined);
    // WHAT: Skip installation when the validated join already owns the current hash.
    // WHY: Duplicate delivery must not create projection or persistence work.
    if (entities.get(key)?.stateHash === joined.stateHash) return false;
    entities.set(key, joined);
    updateBucket(key, joined);
    for (const register of Object.values(joined.fields)) {
      for (const [replicaId, counter] of Object.entries(register.clock)) {
        clock[replicaId] = Math.max(clock[replicaId] ?? 0, counter);
      }
    }
    materializeTaskCurrentEntity(projection, joined, { deferClockCanonicalization: deferProjectionClockCanonicalization });
    projectionMaterializationCount += 1;
    return true;
  };

  const mutationLanes = (change: TaskEntityChange): TaskEntityChange[] => change.entityType === 'ledger'
    ? change.changes.map((field) => ({ ...change, entityId: `${change.entityId}:${field.path}`, changes: [field] }))
    : [change];

  const mutationContext = (changes: TaskEntityChange[]): TaskCausalClock => changes
    .flatMap(mutationLanes)
    .reduce((context, lane) => {
      const current = entities.get(`${lane.entityType}\u0000${lane.entityId}`);
      const paths = lane.changes.some((field) => field.path === '$entity')
        ? lane.changes.map((field) => field.path)
        : ['$entity', ...lane.changes.map((field) => field.path)];
      return paths.reduce((joined, path) => joinTaskClocks(joined, current?.fields[path]?.clock ?? {}), context);
    }, {} as TaskCausalClock);

  const applyMutation = (batch: TaskMutationBatch): TaskCurrentEntity[] => batch.changes.flatMap((change) => mutationLanes(change).flatMap((lane) => {
    const key = `${lane.entityType}\u0000${lane.entityId}`;
    const incoming = registerEntity(batch, lane, entities.get(key));
    if (batch.replication === 'held') publication.hold(batch.activationTaskId, key);
    return applyEntity(incoming) ? [entities.get(key)!] : [];
  }));

  const applyActivation = (taskId: string): string[] => {
    const keys = publication.activate(taskId);
    for (const key of keys) {
      const entity = entities.get(key);
      if (entity) updateBucket(key, entity);
    }
    return keys;
  };

  const loadEntityFiles = (): void => {
    deferBucketSummaries = true;
    for (const entityType of taskEntityTypes) {
      const directory = resolve(root, 'current', entityType);
      if (!existsSync(directory)) continue;
      for (const name of readdirSync(directory).filter((value) => value.endsWith('.json')).sort()) {
        shardReadCount += 1;
        applyEntity(JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as TaskCurrentEntity, true, true);
      }
    }
    deferBucketSummaries = false;
    rebuildBucketSummaries();
    canonicalizeTaskProjectionClock(projection);
  };

  function rootHash(): string {
    return hashTaskCurrentRoot(bucketManifest());
  }

  function bucketManifest(): TaskCurrentBucket[] {
    return [...bucketSummaries.values()].sort((left, right) => left.bucket.localeCompare(right.bucket)).map((entry) => ({ ...entry }));
  }

  const formatDocument = (): TaskCurrentFormat => ({
    stateProtocol: taskStateProtocol,
    stateSchema: taskCurrentStateVersion,
    baselineEpoch: taskCurrentBaselineEpoch,
    projectId: options.projectId,
    baselineRoot: rootHash(),
  });

  const initialize = (): void => {
    mkdirSync(journalDirectory, { recursive: true });
    const replicaId = options.initializeReplica?.replicaId ?? 'baseline';
    const counter = options.initializeReplica?.counter ?? 1;
    const batch: TaskMutationBatch = {
      version: taskCurrentStateVersion,
      batchId: 'baseline',
      projectId: options.projectId,
      replicaId,
      emittedAt: new Date(0).toISOString(),
      dot: { replicaId, counter },
      context: counter > 1 ? { [replicaId]: counter - 1 } : {},
      changes: taskCurrentBaselineChanges(options.initializeLedger ?? {}),
      activationTaskId: '',
      replication: 'active',
    };
    for (const entity of applyMutation(batch)) persistence.atomicWriteSync(persistence.entityPath(entity), `${JSON.stringify(entity)}\n`);
    if (!options.deferFormat) persistence.atomicWriteSync(formatFile, `${JSON.stringify(formatDocument())}\n`);
  };

  const validateFormat = (): void => {
    if (!existsSync(formatFile)) {
      if (options.initializeLedger === undefined) throw new Error('task_state_offline_migration_required');
      initialize();
      if (options.deferFormat) return;
    }
    const format = JSON.parse(readFileSync(formatFile, 'utf8')) as TaskCurrentFormat;
    if (format.stateProtocol !== taskStateProtocol || format.stateSchema !== taskCurrentStateVersion || format.baselineEpoch !== taskCurrentBaselineEpoch || format.projectId !== options.projectId) throw new Error('unsupported_task_current_state_format');
  };

  const recoverJournals = (): void => {
    if (!existsSync(journalDirectory)) return;
    for (const name of readdirSync(journalDirectory).filter((value) => value.endsWith('.json')).sort()) {
      const file = resolve(journalDirectory, name);
      const document = JSON.parse(readFileSync(file, 'utf8')) as JournalDocument;
      if (document.version !== taskCurrentStateVersion) throw new Error('unsupported_task_current_state_journal');
      // WHAT: Retain collision-bearing journals after replaying their independently accepted delta.
      // WHY: Restart must preserve complete local and remote evidence until explicit recovery validates it.
      if (document.repairCollisions) document.repairCollisions.forEach((evidence) => {
        assertRepairCollisionEvidence(evidence);
        retainedCollisionEvidence.set(`${evidence.attemptId}\u0000${evidence.deliveryId}\u0000${evidence.key}`, evidence);
      });
      if (document.repairRecovery) {
        assertRepairRecoveryReceipt(document.repairRecovery);
        collisionRecoveryReceipts.set(document.repairRecovery.attemptId, document.repairRecovery);
      }
      const changed = document.mutation
        ? applyMutation(document.mutation)
        : (document.delta?.entities ?? []).filter((entity) => applyEntity(entity, false, true)).map((entity) => entities.get(taskCurrentEntityKey(entity))!);
      if (document.activateTaskId) applyActivation(document.activateTaskId);
      for (const entity of changed) pendingEntities.set(taskCurrentEntityKey(entity), entity);
      if (!document.repairCollisions && !document.repairRecovery) pendingJournals.add(file);
    }
    for (const name of readdirSync(journalDirectory).filter((value) => value.endsWith('.wal')).sort()) {
      const file = resolve(journalDirectory, name);
      const bytes = readFileSync(file);
      let offset = 0;
      let tornTail = false;
      let containsCollision = false;
      while (offset < bytes.length) {
        const remaining = bytes.length - offset;
        // WHAT: Preserve an incomplete terminal header as an uncommitted crash tail.
        // WHY: No ACK may rely on bytes that never reached a complete framed record.
        if (remaining < repairWalHeaderBytes) { tornTail = true; break; }
        const magic = bytes.subarray(offset, offset + repairWalMagic.length);
        const version = bytes[offset + repairWalMagic.length];
        const lengthOffset = offset + repairWalMagic.length + 1;
        const length = bytes.readUInt32BE(lengthOffset);
        const inverseLength = bytes.readUInt32BE(lengthOffset + 4);
        if (!magic.equals(repairWalMagic) || version !== 1 || ((length ^ inverseLength) >>> 0) !== 0xffff_ffff
          || length < 1 || length > maximumRepairWalPayloadBytes) throw new Error('invalid_task_current_repair_wal');
        const recordBytes = repairWalHeaderBytes + length + 1;
        // WHAT: Preserve an incomplete terminal payload or footer as uncommitted evidence.
        // WHY: A crash before the commit marker and fsync cannot authorize an ACK.
        if (remaining < recordBytes) { tornTail = true; break; }
        const checksumOffset = lengthOffset + 8;
        const payloadOffset = offset + repairWalHeaderBytes;
        const payload = bytes.subarray(payloadOffset, payloadOffset + length);
        if (bytes[payloadOffset + length] !== repairWalCommit
          || !bytes.subarray(checksumOffset, checksumOffset + 32).equals(createHash('sha256').update(payload).digest())) throw new Error('invalid_task_current_repair_wal');
        let document: JournalDocument;
        try { document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload)) as JournalDocument; }
        catch { throw new Error('invalid_task_current_repair_wal'); }
        if (document.version !== taskCurrentStateVersion || (!document.delta && !document.repairCollisions)) throw new Error('invalid_task_current_repair_wal');
        if (document.repairCollisions) {
          containsCollision = true;
          document.repairCollisions.forEach((evidence) => {
            assertRepairCollisionEvidence(evidence);
            retainedCollisionEvidence.set(`${evidence.attemptId}\u0000${evidence.deliveryId}\u0000${evidence.key}`, evidence);
          });
        }
        const changed = (document.delta?.entities ?? []).filter((entity) => applyEntity(entity, false, true)).map((entity) => entities.get(taskCurrentEntityKey(entity))!);
        for (const entity of changed) pendingEntities.set(taskCurrentEntityKey(entity), entity);
        offset += recordBytes;
      }
      // WHAT: Retain torn WAL bytes after replaying their committed prefix.
      // WHY: Invalid or incomplete durable evidence must never be silently deleted.
      if (!tornTail) {
        if (!containsCollision) pendingJournals.add(file);
      }
    }
    canonicalizeTaskProjectionClock(projection);
  };

  const checkpointDiagnostics = (): TaskStateBootstrapReceipt['sourceDiagnostics'] => ({
    status: checkpointStatus,
    error: checkpointError,
    reads: checkpointReadCount,
    shardReads: shardReadCount,
    markerReads: markerReadCount,
    projectionMaterializations: projectionMaterializationCount,
  });

  const checkpointPayload = (generation: string): TaskStateCheckpointPayload => ({
    version: 2,
    projectId: options.projectId,
    entities: [...entities.values()].map((entity) => structuredClone(entity)),
    projection: structuredClone(projection),
    clock: structuredClone(clock),
    buckets: bucketManifest(),
    publication: publication.snapshot(),
    generation,
  });

  const installGeneration = (generation: string): Promise<void> => {
    const operation = generationTail.then(async () => {
      await persistence.atomicWrite(
        generationFile,
        encodeTaskStateGeneration({ projectId: options.projectId, generation }),
      );
      checkpointGeneration = generation;
    });
    generationTail = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const publishRestartSnapshot = async (persist: boolean): Promise<TaskStateBootstrapReceipt> => {
    const sourceDiagnostics = checkpointDiagnostics();
    let generation = checkpointGeneration;
    // WHAT: Create one compact witness when this store has not yet owned a restart generation.
    // WHY: Cold and legacy reconstruction need a constant-work identity before their state can cross the worker boundary.
    if (!generation) {
      generation = randomUUID();
      await installGeneration(generation);
    }
    const payload = checkpointPayload(generation);
    let persistent = false;
    // WHAT: Publish checkpoint bytes only for a cache-admissible canonical state.
    // WHY: Invalid retained cache evidence and recovery journals may still use an ephemeral worker receipt without rewriting durable evidence.
    if (persist) {
      try {
        await persistence.atomicWrite(checkpointFile, encodeTaskStateCheckpoint(payload));
        persistent = true;
        checkpointStatus = 'warm';
        checkpointError = '';
      } catch (error) {
        checkpointError = error instanceof Error ? error.message : String(error);
      }
    }
    const receipt = createTaskStateBootstrapReceipt({ payload, persistent, sourceDiagnostics });
    // WHAT: Retain the receipt only while no concurrent mutation advanced its generation.
    // WHY: A checkpoint write racing a new journal may finish, but its older marker cannot become in-memory restart authority.
    if (checkpointGeneration === generation) {
      checkpointSnapshotCurrent = true;
      currentBootstrapReceipt = receipt;
    }
    return receipt;
  };

  const persistCheckpoint = async (): Promise<void> => {
    // WHAT: Skip cache publication for migration shadows, invalid retained cache bytes, and retained recovery evidence.
    // WHY: Optimization state must not alter migration or collision-recovery authority.
    if (checkpointWritesDisabled || hasRetainedJournalEvidence()) return;
    await publishRestartSnapshot(true);
  };

  const runMaterializer = async (): Promise<void> => {
    for (;;) {
      while (pendingEntities.size > 0 || publication.hasPending() || pendingJournals.size > 0) {
        const currentEntities = [...pendingEntities.values()];
        const held = publication.drain();
        const currentJournals = [...pendingJournals];
        pendingEntities.clear(); pendingJournals.clear();
        try {
          // WHAT: Remove an admitted checkpoint before canonical files advance.
          // WHY: A crash must select shards and journals instead of stale cached state.
          if (!checkpointWritesDisabled && existsSync(checkpointFile)) await persistence.durableRemove(checkpointFile);
          await runBoundedTaskMaterialization(currentEntities, async (entity) => { await persistence.atomicWrite(persistence.entityPath(entity), `${JSON.stringify(entity)}\n`); });
          await runBoundedTaskMaterialization(held.writes, async (taskId) => { await persistence.atomicWrite(publication.markerFile(taskId), `${JSON.stringify(publication.marker(taskId))}\n`); });
          await runBoundedTaskMaterialization(held.deletes, async (taskId) => persistence.durableRemove(publication.markerFile(taskId)));
          await runBoundedTaskMaterialization(currentJournals, persistence.durableRemove);
        } catch (error) {
          for (const entity of currentEntities) pendingEntities.set(taskCurrentEntityKey(entity), entity);
          publication.restore(held);
          for (const file of currentJournals) pendingJournals.add(file);
          throw error;
        }
      }
      await persistCheckpoint();
      // WHAT: Repeat canonical settlement when a mutation arrived during checkpoint I/O.
      // WHY: The materializer promise must not strand newly queued durable work.
      if (pendingEntities.size === 0 && !publication.hasPending() && pendingJournals.size === 0) return;
    }
  };

  const scheduleMaterializer = (): void => {
    if (materializer) return;
    materializerError = null;
    materializer = runMaterializer().catch((error: unknown) => {
      materializerError = error instanceof Error ? error : new Error(String(error));
      try { options.onPersistenceError?.(materializerError); }
      catch { /* Persistence error reporting cannot replace the original materialization failure. */ }
    }).finally(() => { materializer = null; });
  };

  const deferredMaterialization = new Map<string, { entities: Map<string, TaskCurrentEntity>; journals: Set<string> }>();
  const repairWalFiles = new Map<string, string>();

  const invalidateRestartSnapshot = async (): Promise<void> => {
    const generation = randomUUID();
    await installGeneration(generation);
    checkpointSnapshotCurrent = false;
    currentBootstrapReceipt = null;
  };

  const resumeMaterialization = (authority: string): void => {
    const deferred = deferredMaterialization.get(authority);
    // WHAT: Ignore release of an attempt that retained no deferred shard work.
    // WHY: Replacement and timeout cleanup must remain idempotent.
    if (!deferred) return;
    deferredMaterialization.delete(authority);
    repairWalFiles.delete(authority);
    for (const [key, entity] of deferred.entities) pendingEntities.set(key, entity);
    for (const journalFile of deferred.journals) pendingJournals.add(journalFile);
    scheduleMaterializer();
  };

  const journal = async (document: JournalDocument, id: string): Promise<string> => {
    const file = resolve(journalDirectory, `${encodeURIComponent(id)}.json`);
    try {
      await invalidateRestartSnapshot();
      const encodeStartedAt = performance.now();
      const bytes = `${JSON.stringify(document)}\n`;
      mergeTiming.journalEncodeMs += performance.now() - encodeStartedAt;
      const timing = await persistence.atomicWrite(file, bytes);
      mergeTiming.journalWriteMs += timing.openWriteMs + timing.mkdirMs;
      mergeTiming.journalFileSyncMs += timing.fileSyncMs;
      mergeTiming.journalRenameMs += timing.renameMs;
      mergeTiming.journalDirectorySyncMs += timing.directorySyncMs;
    } catch (error) {
      // WHAT: Notify the owning project scope before returning the durable-write failure.
      // WHY: The server must pause only that project while preserving the original persistence error.
      try { options.onPersistenceError?.(error instanceof Error ? error : new Error(String(error))); }
      catch { /* Persistence diagnostics cannot replace the original durable-write failure. */ }
      throw error;
    }
    return file;
  };

  const repairJournal = async (document: JournalDocument, authority: string): Promise<string> => {
    const file = repairWalFiles.get(authority) ?? resolve(journalDirectory, `repair-${randomUUID()}.wal`);
    repairWalFiles.set(authority, file);
    await invalidateRestartSnapshot();
    const encodeStartedAt = performance.now();
    const payload = Buffer.from(JSON.stringify(document), 'utf8');
    if (payload.length < 1 || payload.length > maximumRepairWalPayloadBytes) throw new Error('task_current_repair_wal_payload_limit');
    const header = Buffer.alloc(repairWalHeaderBytes);
    repairWalMagic.copy(header, 0);
    header[repairWalMagic.length] = 1;
    const lengthOffset = repairWalMagic.length + 1;
    header.writeUInt32BE(payload.length, lengthOffset);
    header.writeUInt32BE((~payload.length) >>> 0, lengthOffset + 4);
    createHash('sha256').update(payload).digest().copy(header, lengthOffset + 8);
    const bytes = Buffer.concat([header, payload, Buffer.from([repairWalCommit])]);
    mergeTiming.journalEncodeMs += performance.now() - encodeStartedAt;
    let timing: Awaited<ReturnType<typeof persistence.appendDurable>>;
    try { timing = await persistence.appendDurable(file, bytes); }
    catch (error) {
      repairWalFiles.delete(authority);
      throw error;
    }
    mergeTiming.journalWriteMs += timing.writeMs;
    mergeTiming.journalOpenMs += timing.openMs;
    mergeTiming.journalQueueWaitMs += timing.queueWaitMs;
    mergeTiming.journalFileSyncMs += timing.fileSyncMs;
    mergeTiming.journalDirectorySyncMs += timing.directorySyncMs;
    return file;
  };

  const installCheckpointPayload = (
    payload: LegacyTaskStateCheckpointPayload | TaskStateCheckpointPayload,
  ): void => {
    publication.installSnapshot(payload.publication);
    // WHAT: Install every validated cached entity into its stable identity map.
    // WHY: Worker receipt validation has already rejected duplicates and cross-project entries.
    for (const entity of payload.entities) entities.set(taskCurrentEntityKey(entity), entity);
    Object.assign(projection, structuredClone(payload.projection));
    clock = structuredClone(payload.clock);
    // WHAT: Restore every validated bucket summary carried by the same snapshot.
    // WHY: Root and manifest reads must remain consistent with transferred entity authority.
    for (const summary of payload.buckets) bucketSummaries.set(summary.bucket, { ...summary });
    // WHAT: Rebuild active bucket membership from the admitted cached entities.
    // WHY: Bucket entity maps are process-local indexes and are not serialized independently.
    for (const [key, entity] of entities) {
      // WHAT: Exclude locally held entities from the active replication bucket map.
      // WHY: Checkpoint restore must preserve the same publication visibility as marker reconstruction.
      if (publication.isHeld(key)) continue;
      const bucket = taskCurrentBucketForEntityKey(key);
      const entries = bucketEntries.get(bucket) ?? new Map<string, TaskCurrentEntity>();
      entries.set(key, entity);
      bucketEntries.set(bucket, entries);
    }
  };

  validateFormat();
  let restoredCheckpoint = false;
  // WHAT: Install the worker-validated snapshot without reopening its checkpoint or canonical shards.
  // WHY: One project bootstrap has exactly one filesystem reconstruction owner.
  if (options.bootstrapReceipt) {
    const payload = validateTaskStateBootstrapReceipt({
      receipt: options.bootstrapReceipt,
      generationFile,
      projectId: options.projectId,
    });
    installCheckpointPayload(payload);
    checkpointGeneration = payload.generation;
    checkpointSnapshotCurrent = true;
    currentBootstrapReceipt = options.bootstrapReceipt;
    checkpointStatus = 'warm';
    restoredCheckpoint = true;
  }
  // WHAT: Attempt checkpoint admission only for ordinary committed task-state startup.
  // WHY: Migration shadows, worker-installed authority, and explicit incident recovery require a different validation boundary.
  else if (!options.deferFormat && !options.forceCanonicalValidation) {
    checkpointReadCount += 1;
    const retained = readTaskStateCheckpoint({
      file: checkpointFile,
      generationFile,
      projectId: options.projectId,
      legacyWitness: () => taskStateCheckpointWitness(checkpointPaths),
    });
    // WHAT: Install one current checkpoint only when no retained recovery journal exists.
    // WHY: Collision evidence and post-checkpoint mutations require canonical replay.
    if (retained.status === 'valid' && !hasRetainedJournalEvidence()) {
      installCheckpointPayload(retained.payload);
      // WHAT: Retain compact generation authority only for the version-2 checkpoint schema.
      // WHY: A legacy witness must be replaced before it can cross the worker boundary.
      checkpointGeneration = retained.payload.version === 2 ? retained.payload.generation : '';
      checkpointSnapshotCurrent = retained.payload.version === 2;
      checkpointStatus = 'warm';
      // WHAT: Reuse the already parsed version-2 payload as the worker handoff receipt.
      // WHY: A warm worker must not rewrite or reread an identical persistent checkpoint.
      if (retained.payload.version === 2) {
        currentBootstrapReceipt = createTaskStateBootstrapReceipt({
          payload: retained.payload,
          persistent: true,
          sourceDiagnostics: checkpointDiagnostics(),
        });
      }
      restoredCheckpoint = true;
    } else {
      // WHAT: Classify a structurally valid checkpoint as stale when retained journals block admission.
      // WHY: An externally restored journal must remain visible even when its generation marker was not advanced by this process.
      if (retained.status === 'valid') {
        checkpointStatus = 'invalid';
        checkpointError = 'stale_task_state_checkpoint';
      }
      // WHAT: Preserve and disable only a checkpoint whose own bytes or canonical witness are invalid.
      // WHY: A valid checkpoint blocked by retained journals may be safely replaced after canonical recovery settles.
      if (retained.status === 'invalid') {
        checkpointStatus = 'invalid';
        checkpointError = retained.error;
        checkpointWritesDisabled = retained.preserve;
        checkpointGeneration = retained.generation ?? '';
      }
    }
  }
  // WHAT: Reconstruct canonical state only when no valid current checkpoint was admitted.
  // WHY: Warm startup must avoid per-marker and per-shard filesystem work.
  if (!restoredCheckpoint) {
    markerReadCount = existsSync(heldDirectory) ? readdirSync(heldDirectory).filter((name) => name.endsWith('.json')).length : 0;
    publication.load();
    loadEntityFiles();
    recoverJournals();
    // WHAT: Mark a successful canonical load as cold unless invalid cache evidence owns diagnostics.
    // WHY: Invalid cache bytes must remain visible and must not be overwritten automatically.
    if (checkpointStatus !== 'invalid') checkpointStatus = 'cold';
    scheduleMaterializer();
  }

  return {
    root,
    formatFile,
    projection: (): TaskCurrentProjection => projection,
    clock: (): TaskCausalClock => ({ ...clock }),
    clientClock: (): TaskCausalClock => Object.fromEntries(
      // WHAT: Keep immutable migration coordinates in durable state while bounding browser response metadata.
      // WHY: Configured node IDs cannot contain ':', so only synthetic migration writers match this prefix.
      Object.entries(clock).filter(([replicaId]) => !replicaId.startsWith('migration:')),
    ),
    rootHash,
    bucketManifest,
    entitiesForBuckets(buckets: string[]): TaskCurrentEntity[] {
      const requested = new Set(buckets);
      return [...entities.entries()].filter(([key]) => !publication.isHeld(key) && requested.has(taskCurrentBucketForEntityKey(key))).map(([, entity]) => structuredClone(entity));
    },
    activeDelta(entityKeys?: string[]): TaskStateDelta {
      const requested = entityKeys ? new Set(entityKeys) : null;
      return { version: taskCurrentStateVersion, projectId: options.projectId, entities: [...entities].filter(([key]) => !publication.isHeld(key) && (!requested || requested.has(key))).map(([, entity]) => structuredClone(entity)) };
    },
    entity(entityType: TaskCurrentEntity['entityType'], entityId: string): TaskCurrentEntity | null {
      const value = entities.get(`${entityType}\u0000${entityId}`);
      return value ? structuredClone(value) : null;
    },
    projectedEntity(entityType: 'card' | 'annotation' | 'relationship', entityId: string): Record<string, unknown> | null {
      return projectedTaskCurrentEntity(projection, entityType, entityId);
    },
    async commitFormat(): Promise<void> {
      await persistence.atomicWrite(formatFile, `${JSON.stringify(formatDocument())}\n`);
    },
    contentHeads(key = ''): Array<{ type: 'card-markdown' | 'thread-markdown' | 'managed-asset'; key: string; hash: string; bytes: number; changedAt: string; sourceReplicaId: string }> {
      const candidates = key ? [entities.get(`resource\u0000${key}`)] : [...entities.values()];
      return candidates.flatMap((entity) => {
        if (!entity || entity.entityType !== 'resource' || (key && entity.entityId !== key)) return [];
        return (entity.fields.head?.candidates ?? []).flatMap((candidate) => {
          if (candidate.operation !== 'set' || !candidate.value || typeof candidate.value !== 'object') return [];
          const value = candidate.value as Record<string, unknown>;
          const type = String(value.type ?? 'managed-asset');
          if (type !== 'card-markdown' && type !== 'thread-markdown' && type !== 'managed-asset') return [];
          return [{ type, key: entity.entityId, hash: String(value.hash ?? ''), bytes: Number(value.bytes ?? 0), changedAt: String(value.changedAt ?? ''), sourceReplicaId: candidate.dot.replicaId }];
        });
      });
    },
    mutate(input: { replicaId: string; changes: TaskEntityChange[]; activationTaskId?: string; replication?: 'active' | 'held'; emittedAt?: string }): Promise<{ batch: TaskMutationBatch; delta: TaskStateDelta }> {
      return serializeTransition(async () => {
        const counter = (clock[input.replicaId] ?? 0) + 1;
        const batch: TaskMutationBatch = {
          version: taskCurrentStateVersion,
          batchId: `${input.replicaId}-${counter}-${randomUUID()}`,
          projectId: options.projectId,
          replicaId: input.replicaId,
          emittedAt: input.emittedAt ?? new Date().toISOString(),
          dot: { replicaId: input.replicaId, counter },
          context: mutationContext(input.changes),
          changes: structuredClone(input.changes),
          activationTaskId: input.activationTaskId ?? '',
          replication: input.replication ?? 'active',
        };
        const journalFile = await journal({ version: taskCurrentStateVersion, mutation: batch }, batch.batchId);
        const changed = applyMutation(batch);
        for (const entity of changed) pendingEntities.set(taskCurrentEntityKey(entity), entity);
        pendingJournals.add(journalFile);
        scheduleMaterializer();
        return { batch, delta: { version: taskCurrentStateVersion, projectId: options.projectId, entities: changed.filter((entity) => !publication.isHeld(taskCurrentEntityKey(entity))).map((entity) => structuredClone(entity)) } };
      });
    },
    activate(taskId: string): Promise<TaskStateDelta> {
      return serializeTransition(async () => {
        const keys = publication.keysForTask(taskId);
        // WHAT: Return an empty activation when the task owns no held entities.
        // WHY: An idempotent activation must not create a journal.
        if (keys.length === 0) return { version: taskCurrentStateVersion, projectId: options.projectId, entities: [] };
        const journalFile = await journal({ version: taskCurrentStateVersion, activateTaskId: taskId }, `activate-${taskId}-${randomUUID()}`);
        applyActivation(taskId);
        pendingJournals.add(journalFile);
        scheduleMaterializer();
        return this.activeDelta(keys);
      });
    },
    resumeMaterialization,
    adoptPublicationCollisionEvidence(input: { attemptId: string; deliveryId: string; rejected: TaskRepairCollisionRejection[]; submittedEntities: TaskCurrentEntity[] }): Promise<TaskRepairCollisionEvidence[]> {
      return serializeTransition(async () => {
        const submitted = new Map(input.submittedEntities.map((entity) => [taskCurrentEntityKey(entity), entity]));
        // WHAT: Reject incomplete or duplicate publication evidence before searching the retained collision archive.
        // WHY: Recovery authority requires one exact submitted entity for every relay rejection.
        if (!input.attemptId || !input.deliveryId || input.rejected.length < 1
          || submitted.size !== input.submittedEntities.length || input.rejected.length !== submitted.size) throw new Error('invalid_task_current_publication_collision_evidence');
        const evidence = input.rejected.map((rejection): TaskRepairCollisionEvidence => {
          const localEntity = submitted.get(rejection.key);
          const remoteEntity = [...retainedCollisionEvidence.values()]
            .flatMap((candidate) => [candidate.localEntity, candidate.remoteEntity])
            .find((candidate) => taskCurrentEntityKey(candidate) === rejection.key && candidate.stateHash === rejection.receiverStateHash);
          // WHAT: Bind the current submitted entity to an exact complete receiver entity already retained durably.
          // WHY: A hash-only relay ACK may recover only when the receiver bytes are independently present in the local archive.
          if (!localEntity || !remoteEntity || entities.get(rejection.key)?.stateHash !== rejection.stateHash
            || localEntity.stateHash !== rejection.stateHash) throw new Error('task_current_publication_collision_archive_missing');
          const item: TaskRepairCollisionEvidence = {
            ...rejection,
            version: taskCurrentStateVersion,
            projectId: options.projectId,
            attemptId: input.attemptId,
            deliveryId: input.deliveryId,
            recordedAt: new Date().toISOString(),
            localEntity: structuredClone(localEntity),
            remoteEntity: structuredClone(remoteEntity),
            direction: 'publication',
          };
          assertRepairCollisionEvidence(item);
          let collisions: ReturnType<typeof taskCurrentDotCollisionCoordinates> = [];
          try { joinTaskEntities(localEntity, remoteEntity); } catch (error) { collisions = taskCurrentDotCollisionCoordinates(error); }
          // WHAT: Require the complete entities to reproduce the relay's exact collision coordinates.
          // WHY: A forged or stale rejection must not become recovery authority.
          if (JSON.stringify(collisions) !== JSON.stringify(rejection.collisions)) throw new Error('invalid_task_current_publication_collision_evidence');
          return item;
        });
        const journalFile = await repairJournal({ version: taskCurrentStateVersion, repairCollisions: evidence }, input.attemptId);
        await persistence.sealAppend(journalFile);
        for (const item of evidence) retainedCollisionEvidence.set(`${item.attemptId}\u0000${item.deliveryId}\u0000${item.key}`, item);
        return evidence.map((item) => structuredClone(item));
      });
    },
    mergeRepairGroup(deliveries: RepairDelivery[], authority: string): Promise<{ deliveries: RepairDeliveryResult[]; delta: TaskStateDelta }> {
      return serializeTransition(async () => {
        // WHAT: Reject an empty, cross-attempt, or cross-project repair group before evaluating entity joins.
        // WHY: One WAL authority may cover only one bounded project attempt.
        if (deliveries.length < 1 || !authority || deliveries.some(({ attemptId, deliveryId, delta }) => !attemptId || attemptId !== authority || !deliveryId
          || delta.version !== taskCurrentStateVersion || delta.projectId !== options.projectId)) throw new Error('invalid_task_state_repair_group');
        const preview = new Map(entities);
        const accepted = new Map<RepairDelivery, TaskCurrentEntity[]>();
        const rejected: Array<{ delivery: RepairDelivery; evidence: TaskRepairCollisionEvidence }> = [];
        for (const delivery of deliveries) {
          const acceptedEntities: TaskCurrentEntity[] = [];
          for (const remoteEntity of delivery.delta.entities) {
            const key = taskCurrentEntityKey(remoteEntity);
            const localEntity = preview.get(key);
            try {
              preview.set(key, joinTaskEntities(localEntity, remoteEntity));
              acceptedEntities.push(remoteEntity);
            }
            catch (error) {
              const collisions = taskCurrentDotCollisionCoordinates(error);
              // WHAT: Propagate non-collision join failures without turning them into terminal repair evidence.
              // WHY: Schema, identity, and hash failures remain protocol errors owned by their existing containment boundary.
              if (!localEntity || collisions.length < 1) throw error;
              rejected.push({ delivery, evidence: {
                version: taskCurrentStateVersion,
                projectId: options.projectId,
                attemptId: delivery.attemptId,
                deliveryId: delivery.deliveryId,
                recordedAt: new Date().toISOString(),
                code: 'task_current_dot_collision',
                key,
                stateHash: remoteEntity.stateHash,
                receiverStateHash: localEntity.stateHash,
                collisions: collisions.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
                localEntity: structuredClone(localEntity),
                remoteEntity: structuredClone(remoteEntity),
              } });
            }
          }
          accepted.set(delivery, acceptedEntities);
        }
        const acceptedDelta: TaskStateDelta = {
          version: taskCurrentStateVersion,
          projectId: options.projectId,
          entities: [...accepted.values()].flat(),
        };
        const changedKeys = new Set<string>();
        for (const entity of acceptedDelta.entities) {
          const key = taskCurrentEntityKey(entity);
          const joined = preview.get(key);
          // WHAT: Record only accepted entities whose final group join changes receiver state.
          // WHY: Duplicate deliveries need exact ACK hashes without redundant materialization work.
          if (joined && joined.stateHash !== entities.get(key)?.stateHash) changedKeys.add(key);
        }
        // WHAT: Skip the WAL only when every accepted delivery is idempotent and no collision evidence exists.
        // WHY: A terminal rejection must be durable before it is returned even when no healthy shard changes.
        if (changedKeys.size > 0 || rejected.length > 0) {
          const document: JournalDocument = {
            version: taskCurrentStateVersion,
            ...(changedKeys.size > 0 ? { delta: acceptedDelta } : {}),
            ...(rejected.length > 0 ? { repairCollisions: rejected.map(({ evidence }) => evidence) } : {}),
          };
          const journalFile = await repairJournal(document, authority);
          // WHAT: Seal a collision-bearing WAL after its bounded group record reaches durability.
          // WHY: Retained evidence must not leave an open descriptor after its repair attempt settles.
          if (rejected.length > 0) await persistence.sealAppend(journalFile);
          for (const key of changedKeys) installJoinedEntity(preview.get(key)!, true);
          canonicalizeTaskProjectionClock(projection);
          const deferred = deferredMaterialization.get(authority) ?? { entities: new Map<string, TaskCurrentEntity>(), journals: new Set<string>() };
          for (const key of changedKeys) deferred.entities.set(key, entities.get(key)!);
          // WHAT: Retain a collision-bearing WAL instead of scheduling its deletion after shard materialization.
          // WHY: Complete local and remote evidence must survive restart until an explicit recovery validates it.
          if (rejected.length < 1) deferred.journals.add(journalFile);
          deferredMaterialization.set(authority, deferred);
          for (const { evidence } of rejected) retainedCollisionEvidence.set(`${evidence.attemptId}\u0000${evidence.deliveryId}\u0000${evidence.key}`, evidence);
        }
        const results: RepairDeliveryResult[] = deliveries.map((delivery) => {
          const acceptedResults = (accepted.get(delivery) ?? []).map((entity): RepairAcceptedEntry => {
            const key = taskCurrentEntityKey(entity);
            return { key, stateHash: entity.stateHash, receiverStateHash: entities.get(key)?.stateHash ?? '', changed: changedKeys.has(key) };
          });
          const rejectedResults = rejected.filter((candidate) => candidate.delivery === delivery).map(({ evidence }) => {
            const { localEntity: _localEntity, remoteEntity: _remoteEntity, version: _version, projectId: _projectId, attemptId: _attemptId, deliveryId: _deliveryId, recordedAt: _recordedAt, ...wire } = evidence;
            return wire;
          });
          return { attemptId: delivery.attemptId, deliveryId: delivery.deliveryId, accepted: acceptedResults, rejected: rejectedResults };
        });
        return { deliveries: results, delta: { ...acceptedDelta, entities: [...changedKeys].map((key) => structuredClone(entities.get(key)!)) } };
      });
    },
    recoverRepairCollisionLocalAuthority(attemptId: string): Promise<TaskRepairCollisionRecoveryReceipt> {
      return serializeTransition(async () => {
        const existing = collisionRecoveryReceipts.get(attemptId);
        const evidence = [...retainedCollisionEvidence.values()]
          .filter((candidate) => candidate.attemptId === attemptId)
          .sort((left, right) => `${left.deliveryId}\u0000${left.key}`.localeCompare(`${right.deliveryId}\u0000${right.key}`));
        // WHAT: Reject recovery without retained collision evidence for the exact attempt.
        // WHY: Local authority cannot manufacture a successor without both submitted and receiver states.
        if (!attemptId || evidence.length < 1) throw new Error('task_current_repair_collision_evidence_missing');
        // WHAT: Validate retained artifact objects and resulting entity hashes before reusing a recovery receipt.
        // WHY: Retry and restart must create no second successor while still proving that its selected authority remains durable.
        if (existing) {
          for (const item of evidence) {
            assertRepairCollisionEvidence(item);
            for (const collision of item.collisions) {
              const candidate = item.localEntity.fields[collision.path]?.candidates
                .find(({ dot }) => dot.replicaId === collision.dot.replicaId && dot.counter === collision.dot.counter);
              // WHAT: Reject a retained receipt whose source candidate no longer exists in its archived entity.
              // WHY: Exactly-once recovery remains authoritative only for the originally selected local value.
              if (!candidate) throw new Error('task_current_repair_collision_local_candidate_missing');
              // WHAT: Revalidate immutable execution artifacts on every recovery completion attempt.
              // WHY: Incident resolution must detect objects removed after the successor was committed.
              if (collision.entityType === 'execution' && collision.path === 'artifacts' && Object.hasOwn(candidate, 'value')) {
                await validateRetainedExecutionArtifacts(resolve(root, 'objects'), candidate.value);
              }
            }
          }
          // WHAT: Reject a receipt when any current entity differs from its committed deterministic successor.
          // WHY: A later local change requires a fresh operator decision instead of silently resolving stale evidence.
          if (Object.entries(existing.resultingStateHashes).some(([key, stateHash]) => entities.get(key)?.stateHash !== stateHash)) {
            throw new Error('task_current_repair_recovery_successor_changed');
          }
          return structuredClone(existing);
        }
        for (const item of evidence) {
          assertRepairCollisionEvidence(item);
          const current = entities.get(item.key);
          // WHAT: Reject recovery when receiver state moved beyond the retained local entity.
          // WHY: A stale operator action must never overwrite a later causal transition.
          if (!current || current.stateHash !== (item.direction === 'publication' ? item.stateHash : item.receiverStateHash)) throw new Error('task_current_repair_collision_receiver_changed');
          let recomputed: ReturnType<typeof taskCurrentDotCollisionCoordinates> = [];
          try { joinTaskEntities(current, item.remoteEntity); }
          catch (error) { recomputed = taskCurrentDotCollisionCoordinates(error); }
          // WHAT: Reject evidence whose collision no longer reproduces from its complete entities.
          // WHY: Recovery authority depends on verified causal coordinates, not a retained error string alone.
          if (JSON.stringify(recomputed) !== JSON.stringify(item.collisions)) throw new Error('task_current_repair_collision_not_reproducible');
        }
        const evidenceHash = createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
        const replicaId = `collision-recovery-${evidenceHash.slice(0, 32)}`;
        const changesByEntity = new Map<string, TaskEntityChange>();
        for (const item of evidence) {
          for (const collision of item.collisions) {
            const register = item.localEntity.fields[collision.path];
            const candidate = register?.candidates.find(({ dot }) => dot.replicaId === collision.dot.replicaId && dot.counter === collision.dot.counter);
            // WHAT: Reject evidence whose local entity lacks the exact colliding candidate.
            // WHY: The recovery mutation must reassert the verified local operation and value without reinterpretation.
            if (!candidate) throw new Error('task_current_repair_collision_local_candidate_missing');
            // WHAT: Validate every selected execution artifact object before constructing recovery authority.
            // WHY: A local label alone cannot prove that the selected artifact manifest still owns its immutable bytes.
            if (collision.entityType === 'execution' && collision.path === 'artifacts' && Object.hasOwn(candidate, 'value')) {
              await validateRetainedExecutionArtifacts(resolve(root, 'objects'), candidate.value);
            }
            const key = `${collision.entityType}\u0000${collision.entityId}`;
            const change = changesByEntity.get(key) ?? { entityType: collision.entityType, entityId: collision.entityId, changes: [] };
            // WHAT: Add each collided lane once when repeated deliveries retained the same poisoned entity.
            // WHY: One deterministic mutation should dominate duplicate collision evidence without duplicate fields.
            if (!change.changes.some(({ path }) => path === collision.path)) change.changes.push({
              path: collision.path,
              operation: candidate.operation,
              ...(Object.hasOwn(candidate, 'value') ? { value: structuredClone(candidate.value) } : {}),
            });
            changesByEntity.set(key, change);
          }
        }
        const changes = [...changesByEntity.values()].sort((left, right) => `${left.entityType}\u0000${left.entityId}`.localeCompare(`${right.entityType}\u0000${right.entityId}`));
        const counter = (clock[replicaId] ?? 0) + 1;
        const batch: TaskMutationBatch = {
          version: taskCurrentStateVersion,
          batchId: `collision-recovery-${evidenceHash}`,
          projectId: options.projectId,
          replicaId,
          emittedAt: new Date(0).toISOString(),
          dot: { replicaId, counter },
          context: mutationContext(changes),
          changes: structuredClone(changes),
          activationTaskId: '',
          replication: 'active',
        };
        const resultingStateHashes: Record<string, string> = {};
        for (const change of changes.flatMap(mutationLanes)) {
          const key = `${change.entityType}\u0000${change.entityId}`;
          resultingStateHashes[key] = joinTaskEntities(entities.get(key), registerEntity(batch, change, entities.get(key))).stateHash;
        }
        const receipt: TaskRepairCollisionRecoveryReceipt = { version: taskCurrentStateVersion, projectId: options.projectId, attemptId, evidenceHash, replicaId, batchId: batch.batchId, resultingStateHashes };
        await journal({ version: taskCurrentStateVersion, mutation: batch, repairRecovery: receipt }, batch.batchId);
        const changed = applyMutation(batch);
        for (const entity of changed) pendingEntities.set(taskCurrentEntityKey(entity), entity);
        collisionRecoveryReceipts.set(attemptId, receipt);
        scheduleMaterializer();
        return structuredClone(receipt);
      });
    },
    repairCollisionEvidence(attemptId = ''): TaskRepairCollisionEvidence[] {
      return [...retainedCollisionEvidence.values()]
        .filter((evidence) => !attemptId || evidence.attemptId === attemptId)
        .sort((left, right) => `${left.attemptId}\u0000${left.deliveryId}\u0000${left.key}`.localeCompare(`${right.attemptId}\u0000${right.deliveryId}\u0000${right.key}`))
        .map((evidence) => structuredClone(evidence));
    },
    merge(delta: TaskStateDelta, mergeOptions: { deferMaterialization?: string } = {}): Promise<{ changed: boolean; delta: TaskStateDelta; resultingStateHashes: Map<string, string> }> {
      return serializeTransition(async () => {
      mergeTiming.count += 1;
      mergeTiming.entities += delta.entities.length;
      if (delta.version !== taskCurrentStateVersion || delta.projectId !== options.projectId) throw new Error('invalid_task_state_delta');
      const prepareStartedAt = performance.now();
      const grouped = new Map<string, TaskCurrentEntity[]>();
      for (const entity of delta.entities) {
        const key = taskCurrentEntityKey(entity);
        grouped.set(key, [...(grouped.get(key) ?? []), entity]);
      }
      const prepared = [...grouped].map(([key, incoming]) => {
        const current = entities.get(key);
        const joined = incoming.reduce<TaskCurrentEntity | undefined>((value, entity) => joinTaskEntities(value, entity), current)!;
        return { key, incoming, baseHash: current?.stateHash ?? '', joined };
      });
      const changedPreview = prepared.filter(({ baseHash, joined }) => baseHash !== joined.stateHash);
      mergeTiming.prepareMs += performance.now() - prepareStartedAt;
      // WHAT: Return the current resulting hashes without journaling an idempotent delivery.
      // WHY: A duplicate ACK must remain exact while producing no durable write.
      if (changedPreview.length === 0) return {
        changed: false,
        delta: { version: taskCurrentStateVersion, projectId: options.projectId, entities: [] },
        resultingStateHashes: new Map(prepared.map(({ key, joined }) => [key, joined.stateHash])),
      };
      const journalStartedAt = performance.now();
      const journalFile = mergeOptions.deferMaterialization
        ? await repairJournal({ version: taskCurrentStateVersion, delta }, mergeOptions.deferMaterialization)
        : await journal({ version: taskCurrentStateVersion, delta }, `remote-${randomUUID()}`);
      mergeTiming.journalMs += performance.now() - journalStartedAt;
      const installStartedAt = performance.now();
      const changedByKey = new Map<string, TaskCurrentEntity>();
      for (const item of changedPreview) {
        const currentHash = entities.get(item.key)?.stateHash ?? '';
        // WHAT: Install the prepared validated join only while its captured base is still current.
        // WHY: A local mutation during journal persistence must be causally joined, never overwritten.
        if (currentHash === item.baseHash) {
          if (installJoinedEntity(item.joined, true)) changedByKey.set(item.key, entities.get(item.key)!);
        } else {
          for (const incoming of item.incoming) {
            if (applyEntity(incoming, false, true)) changedByKey.set(item.key, entities.get(item.key)!);
          }
        }
      }
      const changed = [...changedByKey.values()];
      canonicalizeTaskProjectionClock(projection);
      mergeTiming.installMs += performance.now() - installStartedAt;
      // WHAT: Keep enhanced-repair shards isolated until that exact attempt settles.
      // WHY: Ordinary local and live remote writes must remain eagerly materialized during repair.
      if (mergeOptions.deferMaterialization) {
        const deferred = deferredMaterialization.get(mergeOptions.deferMaterialization) ?? { entities: new Map<string, TaskCurrentEntity>(), journals: new Set<string>() };
        for (const entity of changed) deferred.entities.set(taskCurrentEntityKey(entity), entity);
        deferred.journals.add(journalFile);
        deferredMaterialization.set(mergeOptions.deferMaterialization, deferred);
      } else {
        for (const entity of changed) pendingEntities.set(taskCurrentEntityKey(entity), entity);
        pendingJournals.add(journalFile);
        scheduleMaterializer();
      }
      const resultCloneStartedAt = performance.now();
      const result = {
        changed: changed.length > 0,
        delta: { version: taskCurrentStateVersion, projectId: options.projectId, entities: changed.map((entity) => structuredClone(entity)) },
        resultingStateHashes: new Map(prepared.map(({ key }) => [key, entities.get(key)?.stateHash ?? ''])),
      };
      mergeTiming.resultCloneMs += performance.now() - resultCloneStartedAt;
      return result;
      });
    },
    async prepareRestartReceipt(): Promise<TaskStateBootstrapReceipt> {
      // WHAT: Wait until every journal, entity, and publication mutation reaches its canonical settlement.
      // WHY: A restart receipt cannot represent work still owned by the asynchronous materializer.
      while (materializer || pendingEntities.size > 0 || publication.hasPending() || pendingJournals.size > 0) {
        // WHAT: Restart a missing materializer while durable canonical work remains queued.
        // WHY: A worker receipt cannot precede settlement of the state it carries.
        if (!materializer) scheduleMaterializer();
        await materializer;
        // WHAT: Propagate the original materialization failure before publishing worker authority.
        // WHY: A receipt must never conceal a failed canonical write.
        if (materializerError) throw materializerError;
      }
      // WHAT: Reuse an already current snapshot without another marker or checkpoint write.
      // WHY: Warm startup should transfer the admitted payload, not republish identical cache bytes.
      if (checkpointSnapshotCurrent && currentBootstrapReceipt) return currentBootstrapReceipt;
      // WHAT: Reject worker handoff when invalid retained cache bytes include no valid generation witness.
      // WHY: Preserving corrupt evidence forbids rewriting it, while main cannot safely install an unwitnessed snapshot.
      if (checkpointWritesDisabled && !checkpointGeneration) {
        throw new Error(checkpointError || 'task_state_restart_generation_unavailable');
      }
      // WHAT: Persist the worker snapshot only while invalid cache evidence and recovery journals permit replacement.
      // WHY: Ephemeral receipt transfer must not rewrite preserved bytes or retained collision authority.
      const persistent = !checkpointWritesDisabled
        && !hasRetainedJournalEvidence();
      return await publishRestartSnapshot(persistent);
    },
    async flush(): Promise<void> {
      for (const authority of [...deferredMaterialization.keys()]) resumeMaterialization(authority);
      while (materializer || pendingEntities.size > 0 || publication.hasPending() || pendingJournals.size > 0) {
        if (!materializer) scheduleMaterializer();
        await materializer;
        if (materializerError) throw materializerError;
      }
    },
    diagnostics(): { entityCount: number; journalCount: number; currentBytes: number; mergeTiming: typeof mergeTiming; checkpoint: { status: string; error: string; reads: number; shardReads: number; markerReads: number; projectionMaterializations: number } } {
      return {
        ...taskCurrentStateDiagnostics({ root, journalDirectory, entityCount: entities.size }),
        mergeTiming: { ...mergeTiming },
        checkpoint: {
          status: checkpointStatus,
          error: checkpointError,
          reads: checkpointReadCount,
          shardReads: shardReadCount,
          markerReads: markerReadCount,
          projectionMaterializations: projectionMaterializationCount,
        },
      };
    },
  };
}

export type TaskCurrentStateStore = ReturnType<typeof createTaskCurrentStateStore>;
