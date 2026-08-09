/**
 * WHAT: Persists epoch-4 causal state through journals, independent shards, and local publication markers.
 * WHY: Local success must follow journal durability while replicated hashes contain only joinable domain state.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import {
  hashTaskCurrentBucket,
  hashTaskCurrentRoot,
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
  type TaskStateDelta,
} from './task-current-state-types.js';

type JournalDocument = { version: typeof taskCurrentStateVersion; mutation?: TaskMutationBatch; delta?: TaskStateDelta; activateTaskId?: string };
const repairWalMagic = Buffer.from('DOSTSWAL');
const repairWalHeaderBytes = repairWalMagic.length + 1 + 4 + 4 + 32;
const repairWalCommit = 0xa5;
const maximumRepairWalPayloadBytes = 16 * 1024 * 1024;
type StoreOptions = {
  decisionOsRoot: string;
  projectId: string;
  initializeLedger?: Record<string, unknown>;
  initializeReplica?: { replicaId: string; counter: number };
  deferFormat?: boolean;
  onPersistenceError?: (error: Error) => void;
};

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
  const entities = new Map<string, TaskCurrentEntity>();
  const publication = createTaskLocalPublicationState(heldDirectory);
  const bucketEntries = new Map<string, Map<string, TaskCurrentEntity>>();
  const bucketSummaries = new Map<string, TaskCurrentBucket>();
  const projection = emptyProjection(options.projectId);
  const pendingEntities = new Map<string, TaskCurrentEntity>();
  const pendingJournals = new Set<string>();
  const persistence = createTaskCurrentStatePersistence(root);
  let clock: TaskCausalClock = {};
  let materializer: Promise<void> | null = null;
  let materializerError: Error | null = null;
  let localMutationTail = Promise.resolve();
  let deferBucketSummaries = false;
  const mergeTiming = { count: 0, entities: 0, prepareMs: 0, journalMs: 0, journalEncodeMs: 0, journalOpenMs: 0, journalQueueWaitMs: 0, journalWriteMs: 0, journalFileSyncMs: 0, journalRenameMs: 0, journalDirectorySyncMs: 0, installMs: 0, resultCloneMs: 0 };

  const serializeLocalMutation = <Result>(operation: () => Promise<Result>): Promise<Result> => {
    const result = localMutationTail.then(operation);
    localMutationTail = result.then(() => undefined, () => undefined);
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
      const changed = document.mutation
        ? applyMutation(document.mutation)
        : (document.delta?.entities ?? []).filter((entity) => applyEntity(entity, false, true)).map((entity) => entities.get(taskCurrentEntityKey(entity))!);
      if (document.activateTaskId) applyActivation(document.activateTaskId);
      for (const entity of changed) pendingEntities.set(taskCurrentEntityKey(entity), entity);
      pendingJournals.add(file);
    }
    for (const name of readdirSync(journalDirectory).filter((value) => value.endsWith('.wal')).sort()) {
      const file = resolve(journalDirectory, name);
      const bytes = readFileSync(file);
      let offset = 0;
      let tornTail = false;
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
        if (document.version !== taskCurrentStateVersion || !document.delta) throw new Error('invalid_task_current_repair_wal');
        const changed = document.delta.entities.filter((entity) => applyEntity(entity, false, true)).map((entity) => entities.get(taskCurrentEntityKey(entity))!);
        for (const entity of changed) pendingEntities.set(taskCurrentEntityKey(entity), entity);
        offset += recordBytes;
      }
      // WHAT: Retain torn WAL bytes after replaying their committed prefix.
      // WHY: Invalid or incomplete durable evidence must never be silently deleted.
      if (!tornTail) pendingJournals.add(file);
    }
    canonicalizeTaskProjectionClock(projection);
  };

  const runMaterializer = async (): Promise<void> => {
    while (pendingEntities.size > 0 || publication.hasPending() || pendingJournals.size > 0) {
      const currentEntities = [...pendingEntities.values()];
      const held = publication.drain();
      const currentJournals = [...pendingJournals];
      pendingEntities.clear(); pendingJournals.clear();
      try {
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

  publication.load();
  validateFormat();
  loadEntityFiles();
  recoverJournals();
  scheduleMaterializer();

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
      return serializeLocalMutation(async () => {
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
    async activate(taskId: string): Promise<TaskStateDelta> {
      const keys = publication.keysForTask(taskId);
      if (keys.length === 0) return { version: taskCurrentStateVersion, projectId: options.projectId, entities: [] };
      const journalFile = await journal({ version: taskCurrentStateVersion, activateTaskId: taskId }, `activate-${taskId}-${randomUUID()}`);
      applyActivation(taskId);
      pendingJournals.add(journalFile);
      scheduleMaterializer();
      return this.activeDelta(keys);
    },
    resumeMaterialization,
    async mergeRepairGroup(deltas: TaskStateDelta[], authority: string): Promise<{ changed: boolean; delta: TaskStateDelta; resultingStateHashes: Map<string, string> }> {
      // WHAT: Commit one bounded enhanced-repair project window through one WAL durability barrier.
      // WHY: Epoch-4 deliveries retain individual ACKs while identical-project frames share the receiver fsync they already arrived under.
      if (deltas.length < 1 || deltas.some((delta) => delta.version !== taskCurrentStateVersion || delta.projectId !== options.projectId)) {
        throw new Error('invalid_task_state_delta');
      }
      return this.merge({
        version: taskCurrentStateVersion,
        projectId: options.projectId,
        entities: deltas.flatMap((delta) => delta.entities),
      }, { deferMaterialization: authority });
    },
    async merge(delta: TaskStateDelta, mergeOptions: { deferMaterialization?: string } = {}): Promise<{ changed: boolean; delta: TaskStateDelta; resultingStateHashes: Map<string, string> }> {
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
    },
    async flush(): Promise<void> {
      for (const authority of [...deferredMaterialization.keys()]) resumeMaterialization(authority);
      while (materializer || pendingEntities.size > 0 || publication.hasPending() || pendingJournals.size > 0) {
        if (!materializer) scheduleMaterializer();
        await materializer;
        if (materializerError) throw materializerError;
      }
    },
    diagnostics(): { entityCount: number; journalCount: number; currentBytes: number; mergeTiming: typeof mergeTiming } {
      return { ...taskCurrentStateDiagnostics({ root, journalDirectory, entityCount: entities.size }), mergeTiming: { ...mergeTiming } };
    },
  };
}

export type TaskCurrentStateStore = ReturnType<typeof createTaskCurrentStateStore>;
