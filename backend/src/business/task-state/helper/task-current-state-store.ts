/**
 * WHAT: Persists epoch-4 causal state through journals, independent shards, and local publication markers.
 * WHY: Local success must follow journal durability while replicated hashes contain only joinable domain state.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  hashTaskCurrentBucket,
  hashTaskCurrentRoot,
  taskCurrentBucketForEntityKey,
  taskCurrentEntityKey,
} from '../../../../../shared/task-current-state-core.js';
import { assertTaskCurrentEntity, finalizeTaskCurrentEntity, joinTaskClocks, joinTaskEntities } from './task-current-state-join.js';
import { materializeTaskCurrentEntity, projectedTaskCurrentEntity } from './materialize-task-current-entity.js';
import { runBoundedTaskMaterialization } from './run-bounded-task-materialization.js';
import { createTaskLocalPublicationState } from './task-local-publication-state.js';
import { taskCurrentBaselineChanges } from './task-current-state-baseline.js';
import { taskCurrentStateDiagnostics } from './task-current-state-diagnostics.js';
import { createTaskCurrentStatePersistence } from './task-current-state-persistence.js';
import {
  buildTaskCurrentInventoryBucket,
  buildTaskCurrentInventoryRoot,
  taskCurrentInventoryBucketFile,
  taskCurrentInventoryRootFile,
  taskCurrentInventoryVersion,
  validateTaskCurrentInventory,
} from './task-current-state-inventory.js';
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
type LoadedJournal = { file: string; document: JournalDocument };
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
  const physicalBucketEntries = new Map<string, Map<string, TaskCurrentEntity>>();
  const physicalBucketSummaries = new Map<string, TaskCurrentBucket>();
  const projection = emptyProjection(options.projectId);
  const pendingEntities = new Map<string, TaskCurrentEntity>();
  const pendingJournals = new Set<string>();
  const persistence = createTaskCurrentStatePersistence(root);
  let clock: TaskCausalClock = {};
  let materializer: Promise<void> | null = null;
  let materializerError: Error | null = null;
  let localMutationTail = Promise.resolve();
  let deferBucketSummaries = false;

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

  const updatePhysicalBucket = (key: string, entity: TaskCurrentEntity): void => {
    const bucket = taskCurrentBucketForEntityKey(key);
    const entries = physicalBucketEntries.get(bucket) ?? new Map<string, TaskCurrentEntity>();
    entries.set(key, entity);
    physicalBucketEntries.set(bucket, entries);
    if (deferBucketSummaries) return;
    physicalBucketSummaries.set(bucket, { bucket, count: entries.size, checksum: hashTaskCurrentBucket(entries) });
  };

  const rebuildBucketSummaries = (): void => {
    bucketSummaries.clear();
    for (const [bucket, entries] of bucketEntries) {
      bucketSummaries.set(bucket, { bucket, count: entries.size, checksum: hashTaskCurrentBucket(entries) });
    }
    physicalBucketSummaries.clear();
    for (const [bucket, entries] of physicalBucketEntries) {
      physicalBucketSummaries.set(bucket, { bucket, count: entries.size, checksum: hashTaskCurrentBucket(entries) });
    }
  };

  const applyEntity = (incoming: TaskCurrentEntity, takeOwnership = false): boolean => {
    if (incoming.projectId !== options.projectId) throw new Error('task_current_project_mismatch');
    const key = taskCurrentEntityKey(incoming);
    const current = entities.get(key);
    let joined: TaskCurrentEntity;
    if (current) joined = joinTaskEntities(current, incoming);
    else if (takeOwnership) {
      assertTaskCurrentEntity(incoming);
      joined = incoming;
    } else joined = joinTaskEntities(undefined, incoming);
    if (entities.get(key)?.stateHash === joined.stateHash) return false;
    entities.set(key, joined);
    updatePhysicalBucket(key, joined);
    updateBucket(key, joined);
    for (const register of Object.values(joined.fields)) {
      for (const [replicaId, counter] of Object.entries(register.clock)) {
        clock[replicaId] = Math.max(clock[replicaId] ?? 0, counter);
      }
    }
    materializeTaskCurrentEntity(projection, joined);
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
        const entity = JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as TaskCurrentEntity;
        if (entity.entityType !== entityType || name !== `${encodeURIComponent(entity.entityId)}.json`) throw new Error(`task_current_entity_path_mismatch:${entityType}:${name}`);
        applyEntity(entity, true);
      }
    }
    deferBucketSummaries = false;
    rebuildBucketSummaries();
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
    inventoryVersion: taskCurrentInventoryVersion,
  });

  const inventoryBucketDocument = (bucket: string) => buildTaskCurrentInventoryBucket(
    options.projectId,
    bucket,
    physicalBucketEntries.get(bucket) ?? new Map(),
  );

  const inventoryRootDocument = () => buildTaskCurrentInventoryRoot(
    options.projectId,
    physicalBucketSummaries.values(),
    publication.snapshot(),
  );

  const writeCompleteInventorySync = (): void => {
    for (const bucket of [...physicalBucketEntries.keys()].sort()) {
      persistence.atomicWriteSync(taskCurrentInventoryBucketFile(root, bucket), `${JSON.stringify(inventoryBucketDocument(bucket))}\n`);
    }
    persistence.atomicWriteSync(taskCurrentInventoryRootFile(root), `${JSON.stringify(inventoryRootDocument())}\n`);
  };

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
    writeCompleteInventorySync();
    if (!options.deferFormat) persistence.atomicWriteSync(formatFile, `${JSON.stringify(formatDocument())}\n`);
  };

  const validateFormat = (): TaskCurrentFormat | null => {
    if (!existsSync(formatFile)) {
      if (options.initializeLedger === undefined) throw new Error('task_state_offline_migration_required');
      initialize();
      if (options.deferFormat) return null;
    }
    const format = JSON.parse(readFileSync(formatFile, 'utf8')) as TaskCurrentFormat;
    if (format.stateProtocol !== taskStateProtocol || format.stateSchema !== taskCurrentStateVersion || format.baselineEpoch !== taskCurrentBaselineEpoch || format.projectId !== options.projectId) throw new Error('unsupported_task_current_state_format');
    if (format.inventoryVersion !== undefined && format.inventoryVersion !== taskCurrentInventoryVersion) throw new Error('unsupported_task_current_inventory_format');
    return format;
  };

  const loadJournals = (): LoadedJournal[] => {
    if (!existsSync(journalDirectory)) return [];
    return readdirSync(journalDirectory).filter((value) => value.endsWith('.json')).sort().map((name) => {
      const file = resolve(journalDirectory, name);
      const document = JSON.parse(readFileSync(file, 'utf8')) as JournalDocument;
      if (document.version !== taskCurrentStateVersion) throw new Error('unsupported_task_current_state_journal');
      if (document.mutation && (document.mutation.version !== taskCurrentStateVersion
        || document.mutation.projectId !== options.projectId
        || !Array.isArray(document.mutation.changes))) throw new Error('invalid_task_current_state_mutation_journal');
      if (document.delta && (document.delta.version !== taskCurrentStateVersion
        || document.delta.projectId !== options.projectId
        || !Array.isArray(document.delta.entities))) throw new Error('invalid_task_current_state_delta_journal');
      if (!document.mutation && !document.delta && !document.activateTaskId) throw new Error('empty_task_current_state_journal');
      return { file, document };
    });
  };

  const journalInventoryEffects = (journals: LoadedJournal[]): { entityKeys: Set<string>; taskIds: Set<string> } => {
    const entityKeys = new Set<string>();
    const taskIds = new Set<string>();
    for (const { document } of journals) {
      for (const change of document.mutation?.changes.flatMap(mutationLanes) ?? []) {
        entityKeys.add(`${change.entityType}\u0000${change.entityId}`);
      }
      for (const entity of document.delta?.entities ?? []) entityKeys.add(taskCurrentEntityKey(entity));
      if (document.activateTaskId) taskIds.add(document.activateTaskId);
      if (document.mutation?.replication === 'held' && document.mutation.activationTaskId) taskIds.add(document.mutation.activationTaskId);
    }
    return { entityKeys, taskIds };
  };

  const recoverJournals = (journals: LoadedJournal[]): void => {
    for (const { file, document } of journals) {
      const changed = document.mutation
        ? applyMutation(document.mutation)
        : (document.delta?.entities ?? []).filter((entity) => applyEntity(entity)).map((entity) => entities.get(taskCurrentEntityKey(entity))!);
      if (document.activateTaskId) applyActivation(document.activateTaskId);
      for (const entity of changed) pendingEntities.set(taskCurrentEntityKey(entity), entity);
      pendingJournals.add(file);
    }
  };

  const runMaterializer = async (): Promise<void> => {
    while (pendingEntities.size > 0 || publication.hasPending() || pendingJournals.size > 0) {
      const currentEntities = [...pendingEntities.values()];
      const held = publication.drain();
      const currentJournals = [...pendingJournals];
      const inventoryBuckets = [...new Set(currentEntities.map((entity) => taskCurrentBucketForEntityKey(taskCurrentEntityKey(entity))))]
        .sort()
        .map((bucket) => ({ bucket, document: inventoryBucketDocument(bucket) }));
      const inventoryRoot = inventoryRootDocument();
      pendingEntities.clear(); pendingJournals.clear();
      try {
        await runBoundedTaskMaterialization(currentEntities, async (entity) => persistence.atomicWrite(persistence.entityPath(entity), `${JSON.stringify(entity)}\n`));
        await runBoundedTaskMaterialization(held.writes, async (taskId) => persistence.atomicWrite(publication.markerFile(taskId), `${JSON.stringify(publication.marker(taskId))}\n`));
        await runBoundedTaskMaterialization(held.deletes, async (taskId) => persistence.durableRemove(publication.markerFile(taskId)));
        await runBoundedTaskMaterialization(inventoryBuckets, async ({ bucket, document }) => persistence.atomicWrite(taskCurrentInventoryBucketFile(root, bucket), `${JSON.stringify(document)}\n`));
        await persistence.atomicWrite(taskCurrentInventoryRootFile(root), `${JSON.stringify(inventoryRoot)}\n`);
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

  const journal = async (document: JournalDocument, id: string): Promise<string> => {
    const file = resolve(journalDirectory, `${encodeURIComponent(id)}.json`);
    try {
      await persistence.atomicWrite(file, `${JSON.stringify(document)}\n`);
    } catch (error) {
      // WHAT: Notify the owning project scope before returning the durable-write failure.
      // WHY: The server must pause only that project while preserving the original persistence error.
      try { options.onPersistenceError?.(error instanceof Error ? error : new Error(String(error))); }
      catch { /* Persistence diagnostics cannot replace the original durable-write failure. */ }
      throw error;
    }
    return file;
  };

  publication.load();
  const format = validateFormat();
  loadEntityFiles();
  const journals = loadJournals();
  const journalEffects = journalInventoryEffects(journals);
  if (format?.inventoryVersion === taskCurrentInventoryVersion) {
    validateTaskCurrentInventory({
      root,
      projectId: options.projectId,
      physicalBuckets: physicalBucketEntries,
      held: publication.snapshot(),
      journalEntityKeys: journalEffects.entityKeys,
      journalTaskIds: journalEffects.taskIds,
    });
  } else if (format) {
    if (existsSync(taskCurrentInventoryRootFile(root))) {
      validateTaskCurrentInventory({
        root,
        projectId: options.projectId,
        physicalBuckets: physicalBucketEntries,
        held: publication.snapshot(),
        journalEntityKeys: journalEffects.entityKeys,
        journalTaskIds: journalEffects.taskIds,
      });
    }
    writeCompleteInventorySync();
    persistence.atomicWriteSync(formatFile, `${JSON.stringify({ ...format, inventoryVersion: taskCurrentInventoryVersion })}\n`);
  }
  recoverJournals(journals);
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
    async merge(delta: TaskStateDelta): Promise<{ changed: boolean; delta: TaskStateDelta }> {
      if (delta.version !== taskCurrentStateVersion || delta.projectId !== options.projectId) throw new Error('invalid_task_state_delta');
      const joined = delta.entities.map((entity) => {
        assertTaskCurrentEntity(entity);
        return joinTaskEntities(entities.get(taskCurrentEntityKey(entity)), entity);
      });
      const changedPreview = joined.filter((entity) => entities.get(taskCurrentEntityKey(entity))?.stateHash !== entity.stateHash);
      if (changedPreview.length === 0) return { changed: false, delta: { version: taskCurrentStateVersion, projectId: options.projectId, entities: [] } };
      const journalFile = await journal({ version: taskCurrentStateVersion, delta }, `remote-${randomUUID()}`);
      const changed = delta.entities.filter((entity) => applyEntity(entity)).map((entity) => entities.get(taskCurrentEntityKey(entity))!);
      for (const entity of changed) pendingEntities.set(taskCurrentEntityKey(entity), entity);
      pendingJournals.add(journalFile);
      scheduleMaterializer();
      return { changed: true, delta: { version: taskCurrentStateVersion, projectId: options.projectId, entities: changed.map((entity) => structuredClone(entity)) } };
    },
    async flush(): Promise<void> {
      while (materializer || pendingEntities.size > 0 || publication.hasPending() || pendingJournals.size > 0) {
        if (!materializer) scheduleMaterializer();
        await materializer;
        if (materializerError) throw materializerError;
      }
    },
    diagnostics(): { entityCount: number; journalCount: number; currentBytes: number } {
      return taskCurrentStateDiagnostics({ root, journalDirectory, entityCount: entities.size });
    },
  };
}

export type TaskCurrentStateStore = ReturnType<typeof createTaskCurrentStateStore>;
