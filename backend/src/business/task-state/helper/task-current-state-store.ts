/**
 * WHAT: Persists sharded causal task state through short-lived crash journals.
 * WHY: Local durability and replica repair must touch changed entities without rewriting project-wide projections.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sha256 } from './task-current-state-codec.js';
import { assertTaskCurrentEntity, finalizeTaskCurrentEntity, hashTaskCurrentEntity, joinTaskClocks, joinTaskEntities } from './task-current-state-join.js';
import { materializeTaskCurrentEntity } from './materialize-task-current-entity.js';
import { taskCurrentBaselineChanges } from './task-current-state-baseline.js';
import { taskCurrentStateDiagnostics } from './task-current-state-diagnostics.js';
import { createTaskCurrentStatePersistence } from './task-current-state-persistence.js';
import { taskCurrentStateVersion, taskEntityTypes, type TaskCausalClock, type TaskCurrentBucket, type TaskCurrentEntity, type TaskCurrentFormat, type TaskCurrentProjection, type TaskEntityChange, type TaskMutationBatch, type TaskStateDelta } from './task-current-state-types.js';

type JournalDocument = { version: 2; mutation?: TaskMutationBatch; delta?: TaskStateDelta };
type StoreOptions = { decisionOsRoot: string; projectId: string; initializeLedger?: Record<string, unknown> };

function entityKey(entity: Pick<TaskCurrentEntity, 'entityType' | 'entityId'>): string {
  return `${entity.entityType}\u0000${entity.entityId}`;
}

function emptyProjection(projectId: string): TaskCurrentProjection {
  return { version: taskCurrentStateVersion, projectId, ledger: { cards: [], annotations: [], relationships: [] }, conflicts: [], clock: {} };
}

function bucketFor(key: string): string {
  return sha256(key).slice(0, 2);
}

function bucketChecksum(entries: Array<[string, TaskCurrentEntity]>): string {
  return sha256(entries.sort(([left], [right]) => left.localeCompare(right)).map(([key, entity]) => `${key}\u0000${entity.stateHash}`).join('\n'));
}

function registerEntity(batch: TaskMutationBatch, change: TaskEntityChange): TaskCurrentEntity {
  const clock = joinTaskClocks(batch.context, { [batch.dot.replicaId]: batch.dot.counter });
  return finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId: batch.projectId,
    entityType: change.entityType,
    entityId: change.entityId,
    fields: Object.fromEntries(change.changes.map((field) => [field.path, {
      clock,
      candidates: [{ dot: batch.dot, operation: field.operation, ...(Object.hasOwn(field, 'value') ? { value: structuredClone(field.value) } : {}) }],
    }])),
    ...(batch.activationTaskId ? { activationTaskId: batch.activationTaskId } : {}),
    replication: batch.replication,
  });
}

export function createTaskCurrentStateStore(options: StoreOptions) {
  const root = resolve(options.decisionOsRoot, 'task-state', options.projectId);
  const formatFile = resolve(root, 'format.json');
  const journalDirectory = resolve(root, 'journal');
  const entities = new Map<string, TaskCurrentEntity>();
  const bucketEntries = new Map<string, Map<string, TaskCurrentEntity>>();
  const bucketSummaries = new Map<string, TaskCurrentBucket>();
  const projection = emptyProjection(options.projectId);
  const pendingEntities = new Map<string, TaskCurrentEntity>();
  const pendingJournals = new Set<string>();
  const persistence = createTaskCurrentStatePersistence(root);
  let clock: TaskCausalClock = {};
  let materializer: Promise<void> | null = null;
  let materializerError: Error | null = null;

  const updateBucket = (key: string, entity: TaskCurrentEntity): void => {
    const bucket = bucketFor(key);
    const entries = bucketEntries.get(bucket) ?? new Map<string, TaskCurrentEntity>();
    if (entity.replication === 'active') entries.set(key, entity);
    else entries.delete(key);
    if (entries.size === 0) {
      bucketEntries.delete(bucket);
      bucketSummaries.delete(bucket);
      return;
    }
    bucketEntries.set(bucket, entries);
    bucketSummaries.set(bucket, { bucket, count: entries.size, checksum: bucketChecksum([...entries]) });
  };

  const applyEntity = (incoming: TaskCurrentEntity): boolean => {
    assertTaskCurrentEntity(incoming);
    if (incoming.projectId !== options.projectId) throw new Error('task_current_project_mismatch');
    const key = entityKey(incoming);
    const joined = joinTaskEntities(entities.get(key), incoming);
    if (entities.get(key)?.stateHash === joined.stateHash) return false;
    entities.set(key, joined);
    updateBucket(key, joined);
    for (const register of Object.values(joined.fields)) clock = joinTaskClocks(clock, register.clock);
    materializeTaskCurrentEntity(projection, joined);
    return true;
  };

  const applyMutation = (batch: TaskMutationBatch): TaskCurrentEntity[] => batch.changes.flatMap((change) => {
    // WHAT: Give each ledger field its own entity lane.
    // WHY: Holding one new task reference must not hide or republish the complete shared ledger entity.
    const lanes = change.entityType === 'ledger'
      ? change.changes.map((field) => ({ ...change, entityId: `${change.entityId}:${field.path}`, changes: [field] }))
      : [change];
    return lanes.flatMap((lane) => {
      const incoming = registerEntity(batch, lane);
      return applyEntity(incoming) ? [entities.get(entityKey(incoming))!] : [];
    });
  });

  const loadEntityFiles = (): void => {
    for (const entityType of taskEntityTypes) {
      const directory = resolve(root, 'current', entityType);
      if (!existsSync(directory)) continue;
      for (const name of readdirSync(directory).filter((value) => value.endsWith('.json')).sort()) {
        const entity = JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as TaskCurrentEntity;
        applyEntity(entity);
      }
    }
  };

  const initialize = (): void => {
    mkdirSync(journalDirectory, { recursive: true });
    const batch: TaskMutationBatch = {
      version: taskCurrentStateVersion,
      batchId: 'baseline',
      projectId: options.projectId,
      replicaId: 'baseline',
      emittedAt: new Date(0).toISOString(),
      dot: { replicaId: 'baseline', counter: 1 },
      context: {},
      changes: taskCurrentBaselineChanges(options.initializeLedger ?? {}),
      activationTaskId: '',
      replication: 'active',
    };
    for (const entity of applyMutation(batch)) persistence.atomicWriteSync(persistence.entityPath(entity), `${JSON.stringify(entity)}\n`);
    const format: TaskCurrentFormat = { version: taskCurrentStateVersion, projectId: options.projectId, baselineRoot: rootHash() };
    persistence.atomicWriteSync(formatFile, `${JSON.stringify(format)}\n`);
  };

  const validateFormat = (): void => {
    if (!existsSync(formatFile)) {
      if (options.initializeLedger === undefined) throw new Error('task_state_offline_migration_required');
      initialize();
    }
    const format = JSON.parse(readFileSync(formatFile, 'utf8')) as TaskCurrentFormat;
    if (format.version !== taskCurrentStateVersion || format.projectId !== options.projectId) throw new Error('unsupported_task_current_state_format');
  };

  const recoverJournals = (): void => {
    if (!existsSync(journalDirectory)) return;
    for (const name of readdirSync(journalDirectory).filter((value) => value.endsWith('.json')).sort()) {
      const file = resolve(journalDirectory, name);
      const document = JSON.parse(readFileSync(file, 'utf8')) as JournalDocument;
      const changed = document.mutation ? applyMutation(document.mutation) : (document.delta?.entities ?? []).filter(applyEntity).map((entity) => entities.get(entityKey(entity))!);
      for (const entity of changed) pendingEntities.set(entityKey(entity), entity);
      pendingJournals.add(file);
    }
  };

  const runMaterializer = async (): Promise<void> => {
    while (pendingEntities.size > 0 || pendingJournals.size > 0) {
      const currentEntities = [...pendingEntities.values()];
      const currentJournals = [...pendingJournals];
      pendingEntities.clear();
      pendingJournals.clear();
      try {
        await Promise.all(currentEntities.map((entity) => persistence.atomicWrite(persistence.entityPath(entity), `${JSON.stringify(entity)}\n`)));
        await Promise.all(currentJournals.map((file) => rm(file, { force: true })));
      } catch (error) {
        for (const entity of currentEntities) pendingEntities.set(entityKey(entity), entity);
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
    }).finally(() => {
      materializer = null;
    });
  };

  const journal = async (document: JournalDocument, id: string): Promise<string> => {
    const file = resolve(journalDirectory, `${encodeURIComponent(id)}.json`);
    await persistence.atomicWrite(file, `${JSON.stringify(document)}\n`);
    return file;
  };

  function rootHash(): string {
    return sha256(bucketManifest().map((bucket) => `${bucket.bucket}\u0000${bucket.count}\u0000${bucket.checksum}`).join('\n'));
  }

  function bucketManifest(): TaskCurrentBucket[] {
    return [...bucketSummaries.values()].sort((left, right) => left.bucket.localeCompare(right.bucket)).map((entry) => ({ ...entry }));
  }

  validateFormat();
  loadEntityFiles();
  recoverJournals();
  scheduleMaterializer();

  return {
    root,
    formatFile,
    projection: (): TaskCurrentProjection => projection,
    clock: (): TaskCausalClock => ({ ...clock }),
    rootHash,
    bucketManifest,
    entitiesForBuckets(buckets: string[]): TaskCurrentEntity[] {
      const requested = new Set(buckets);
      return [...entities.entries()].filter(([key, entity]) => entity.replication === 'active' && requested.has(bucketFor(key))).map(([, entity]) => structuredClone(entity));
    },
    activeDelta(entityKeys?: string[]): TaskStateDelta {
      const requested = entityKeys ? new Set(entityKeys) : null;
      return { version: taskCurrentStateVersion, projectId: options.projectId, entities: [...entities].filter(([key, entity]) => entity.replication === 'active' && (!requested || requested.has(key))).map(([, entity]) => structuredClone(entity)) };
    },
    entity(entityType: TaskCurrentEntity['entityType'], entityId: string): TaskCurrentEntity | null {
      const value = entities.get(`${entityType}\u0000${entityId}`);
      return value ? structuredClone(value) : null;
    },
    async commitFormat(): Promise<void> {
      const format: TaskCurrentFormat = { version: taskCurrentStateVersion, projectId: options.projectId, baselineRoot: rootHash() };
      await persistence.atomicWrite(formatFile, `${JSON.stringify(format)}\n`);
    },
    contentHeads(key = ''): Array<{ type: 'card-markdown' | 'thread-markdown' | 'managed-asset'; key: string; hash: string; bytes: number; changedAt: string; sourceReplicaId: string }> {
      const candidates = key ? [entities.get(`resource\u0000${key}`)] : [...entities.values()];
      return candidates.flatMap((entity) => {
        if (!entity) return [];
        if (entity.entityType !== 'resource' || (key && entity.entityId !== key)) return [];
        const candidates = entity.fields.head?.candidates ?? [];
        return candidates.flatMap((candidate) => {
          if (candidate.operation !== 'set' || !candidate.value || typeof candidate.value !== 'object') return [];
          const value = candidate.value as Record<string, unknown>;
          const type = String(value.type ?? 'managed-asset');
          if (type !== 'card-markdown' && type !== 'thread-markdown' && type !== 'managed-asset') return [];
          return [{ type, key: entity.entityId, hash: String(value.hash ?? ''), bytes: Number(value.bytes ?? 0), changedAt: String(value.changedAt ?? ''), sourceReplicaId: candidate.dot.replicaId }];
        });
      });
    },
    async mutate(input: { replicaId: string; changes: TaskEntityChange[]; activationTaskId?: string; replication?: 'active' | 'held'; emittedAt?: string }): Promise<{ batch: TaskMutationBatch; delta: TaskStateDelta }> {
      const counter = (clock[input.replicaId] ?? 0) + 1;
      const batch: TaskMutationBatch = {
        version: taskCurrentStateVersion,
        batchId: `${input.replicaId}-${counter}-${randomUUID()}`,
        projectId: options.projectId,
        replicaId: input.replicaId,
        emittedAt: input.emittedAt ?? new Date().toISOString(),
        dot: { replicaId: input.replicaId, counter },
        context: { ...clock },
        changes: structuredClone(input.changes),
        activationTaskId: input.activationTaskId ?? '',
        replication: input.replication ?? 'active',
      };
      const journalFile = await journal({ version: taskCurrentStateVersion, mutation: batch }, batch.batchId);
      const changed = applyMutation(batch);
      for (const entity of changed) pendingEntities.set(entityKey(entity), entity);
      pendingJournals.add(journalFile);
      scheduleMaterializer();
      return { batch, delta: { version: taskCurrentStateVersion, projectId: options.projectId, entities: changed.filter((entity) => entity.replication === 'active').map((entity) => structuredClone(entity)) } };
    },
    async activate(taskId: string): Promise<TaskStateDelta> {
      const changed = [...entities.values()].filter((entity) => entity.replication === 'held' && entity.activationTaskId === taskId).map((entity) => finalizeTaskCurrentEntity({ ...entity, replication: 'active' as const }));
      if (changed.length === 0) return { version: taskCurrentStateVersion, projectId: options.projectId, entities: [] };
      const delta = { version: taskCurrentStateVersion, projectId: options.projectId, entities: changed };
      const journalFile = await journal({ version: taskCurrentStateVersion, delta }, `activate-${taskId}-${randomUUID()}`);
      for (const entity of changed) {
        applyEntity(entity);
        const current = entities.get(entityKey(entity))!;
        pendingEntities.set(entityKey(current), current);
      }
      pendingJournals.add(journalFile);
      scheduleMaterializer();
      return this.activeDelta(changed.map(entityKey));
    },
    async merge(delta: TaskStateDelta): Promise<{ changed: boolean; delta: TaskStateDelta }> {
      if (delta.version !== taskCurrentStateVersion || delta.projectId !== options.projectId) throw new Error('invalid_task_state_delta');
      for (const entity of delta.entities) assertTaskCurrentEntity(entity);
      const journalFile = await journal({ version: taskCurrentStateVersion, delta }, `remote-${randomUUID()}`);
      const changed = delta.entities.filter(applyEntity).map((entity) => entities.get(entityKey(entity))!);
      for (const entity of changed) pendingEntities.set(entityKey(entity), entity);
      pendingJournals.add(journalFile);
      scheduleMaterializer();
      return { changed: changed.length > 0, delta: { version: taskCurrentStateVersion, projectId: options.projectId, entities: changed.map((entity) => structuredClone(entity)) } };
    },
    async flush(): Promise<void> {
      while (materializer || pendingEntities.size > 0 || pendingJournals.size > 0) {
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
