/**
 * WHAT: Performs the one-time offline cutover from the retained v2 projection into causal current-state shards.
 * WHY: The server runtime must never parse, migrate, or dual-write the historical representation.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { cp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { buildFederationContentManifest } from '../../federation/helper/federation-content-manifest.js';
import { hydrateLedgerThreadNotes, stripHydratedThreadNotes } from '../../ledger/helper/thread-content-file.js';
import { canonicalJson } from './task-current-state-codec.js';
import { finalizeTaskCurrentEntity } from './task-current-state-join.js';
import { materializeTaskCurrentEntity } from './materialize-task-current-entity.js';
import { createTaskCurrentStateStore } from './task-current-state-store.js';
import { createTaskContentObjectStore, type TaskContentHead } from './task-content-object-store.js';
import { prepareEpoch4ExecutionMigration } from './prepare-epoch4-execution-migration.js';
import { isLegacyExecutionCardField, prepareTaskCurrentStateMigration } from './prepare-task-current-state-migration.js';
import { restoreTaskContentObjects } from './restore-task-content-objects.js';
import { mergeProjectionSourceLedger, prepareProjectionSources, type PreparedProjectionSource } from './task-current-state-projection-sources.js';
import { joinTaskClocks, joinTaskRegisters } from '../../../../../shared/task-current-state-core.js';
import {
  taskCurrentBaselineEpoch,
  taskCurrentStateVersion,
  taskEntityTypes,
  taskStateProtocol,
  type TaskCurrentEntity,
  type TaskCurrentProjection,
  type TaskCurrentRegister,
  type TaskProjectionConflict,
} from './task-current-state-types.js';

type MigrationProjection = { projectId?: string; ledger?: Record<string, unknown>; conflicts?: TaskProjectionConflict[] };
type LegacyEntity = Omit<TaskCurrentEntity, 'version'> & { version: 2 | 3; fields: Record<string, TaskCurrentRegister> };
type MigrationSource = MigrationProjection & { legacyEntities: LegacyEntity[] };

function legacyCurrentProjection(stateRoots: string[], projectId: string): MigrationSource | null {
  const joined = new Map<string, LegacyEntity>();
  for (const stateRoot of stateRoots) {
    for (const entityType of taskEntityTypes) {
      const directory = resolve(stateRoot, 'current', entityType);
      if (!existsSync(directory)) continue;
      for (const name of readdirSync(directory).filter((entry) => entry.endsWith('.json')).sort()) {
        const entity = JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as LegacyEntity;
        if ((entity.version !== 2 && entity.version !== 3) || entity.projectId !== projectId || entity.entityType !== entityType || !entity.entityId) throw new Error(`invalid_legacy_task_entity:${stateRoot}:${entityType}:${name}`);
        const key = `${entityType}\u0000${entity.entityId}`;
        const current = joined.get(key);
        if (!current) { joined.set(key, entity); continue; }
        const fields: Record<string, TaskCurrentRegister> = {};
        for (const path of new Set([...Object.keys(current.fields), ...Object.keys(entity.fields)])) {
          const left = current.fields[path];
          const right = entity.fields[path];
          fields[path] = left && right ? joinTaskRegisters(left, right) : structuredClone(left ?? right!);
        }
        joined.set(key, { ...current, fields });
      }
    }
  }
  if (joined.size === 0) return null;
  const projection: TaskCurrentProjection = { version: taskCurrentStateVersion, projectId, ledger: { cards: [], annotations: [], relationships: [] }, conflicts: [], clock: {} };
  for (const entity of [...joined.values()].sort((left, right) => `${left.entityType}\u0000${left.entityId}`.localeCompare(`${right.entityType}\u0000${right.entityId}`))) {
    materializeTaskCurrentEntity(projection, { ...entity, version: taskCurrentStateVersion });
  }
  return { ...projection, legacyEntities: [...joined.values()] };
}

function projectionSource(stateRoots: string[], tasksLedgerFile: string, projectId: string, decisionOsRoot: string, projectionSources: PreparedProjectionSource[]): MigrationSource {
  const current = legacyCurrentProjection(stateRoots, projectId);
  const activeProjectionFile = resolve(stateRoots[0], 'projection.json');
  const activeProjection = !current && existsSync(activeProjectionFile) ? JSON.parse(readFileSync(activeProjectionFile, 'utf8')) as MigrationProjection : null;
  const baseLedger = current?.ledger ?? activeProjection?.ledger ?? JSON.parse(readFileSync(tasksLedgerFile, 'utf8')) as Record<string, unknown>;
  const ledger = hydrateLedgerThreadNotes(structuredClone(baseLedger), decisionOsRoot);
  for (const source of projectionSources) mergeProjectionSourceLedger(ledger, source.ledger);
  return { ledger, conflicts: [...(current?.conflicts ?? activeProjection?.conflicts ?? []), ...projectionSources.flatMap((source) => source.conflicts)], legacyEntities: current?.legacyEntities ?? [] };
}

function epochResourceEntities(entities: LegacyEntity[]): TaskCurrentEntity[] {
  const placeholders = new Set(['baseline', 'baseline-content']);
  return entities.filter((entity) => entity.entityType === 'resource').flatMap((entity): TaskCurrentEntity[] => {
    const fields = Object.fromEntries(Object.entries(entity.fields).flatMap(([path, register]) => {
      const candidates = register.candidates.filter((candidate) => !placeholders.has(candidate.dot.replicaId));
      // WHAT: Drop legacy placeholder heads once current local files have been captured under the real node identity.
      // WHY: Placeholder replicas are not federation destinations and stale local heads must not become content conflicts.
      if (candidates.length === 0) return [];
      const clock = Object.fromEntries(Object.entries(register.clock).filter(([replicaId]) => !placeholders.has(replicaId)));
      return [[path, { clock, candidates: structuredClone(candidates) }]];
    }));
    if (Object.keys(fields).length === 0) return [];
    return [finalizeTaskCurrentEntity({
      version: taskCurrentStateVersion,
      projectId: entity.projectId,
      entityType: entity.entityType,
      entityId: entity.entityId,
      fields,
    })];
  });
}

function baselineResourceEntities(projectId: string, heads: TaskContentHead[], replicaId: string, counter: number): TaskCurrentEntity[] {
  return heads.map((head) => finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId,
    entityType: 'resource',
    entityId: head.key,
    fields: { head: { clock: { [replicaId]: counter }, candidates: [{ dot: { replicaId, counter }, operation: 'set', value: head }] } },
  }));
}

function migrationCounter(entities: LegacyEntity[], nodeId: string): number {
  let maximum = 0;
  for (const entity of entities) {
    for (const register of Object.values(entity.fields)) maximum = Math.max(maximum, register.clock[nodeId] ?? 0);
  }
  return maximum + 1;
}

function recoveredPresenceEntities(projectId: string, entities: LegacyEntity[], store: ReturnType<typeof createTaskCurrentStateStore>): TaskCurrentEntity[] {
  return entities.flatMap((entity): TaskCurrentEntity[] => {
    if (entity.entityType === 'resource') return [];
    const legacyPresence = entity.fields.$entity;
    if (!legacyPresence) return [];
    const operations = new Set(legacyPresence.candidates.map((candidate) => candidate.operation));
    if ([...operations].some((operation) => operation !== 'set' && operation !== 'tombstone')) throw new Error(`invalid_legacy_presence_operation:${entity.entityType}:${entity.entityId}`);
    // WHAT: Preserve unresolved update-versus-delete candidates without choosing a migration winner.
    // WHY: The explicit conflict entities emitted below must retain their independent causal candidates.
    if (operations.size > 1) return [];
    const current = store.entity(entity.entityType, entity.entityId);
    const currentPresence = current?.fields.$entity;
    const operation = currentPresence?.candidates[0]?.operation ?? (operations.has('tombstone') ? 'tombstone' : 'set');
    if (!current && operation !== 'tombstone') throw new Error(`migration_missing_live_entity:${entity.entityType}:${entity.entityId}`);
    const replicaId = `migration:${projectId}:${entity.entityType}:${entity.entityId}:presence`;
    const clock = joinTaskClocks(joinTaskClocks(legacyPresence.clock, currentPresence?.clock ?? {}), { [replicaId]: 1 });
    return [finalizeTaskCurrentEntity({
      version: taskCurrentStateVersion,
      projectId,
      entityType: entity.entityType,
      entityId: entity.entityId,
      fields: {
        $entity: {
          clock,
          candidates: [{ dot: { replicaId, counter: 1 }, operation, ...(operation === 'set' ? { value: true } : {}) }],
        },
      },
    })];
  });
}

async function mergeEntityBatches(store: ReturnType<typeof createTaskCurrentStateStore>, projectId: string, entities: TaskCurrentEntity[]): Promise<void> {
  for (let index = 0; index < entities.length; index += 128) {
    await store.merge({ version: taskCurrentStateVersion, projectId, entities: entities.slice(index, index + 128) });
  }
}

function conflictEntities(projectId: string, conflicts: TaskProjectionConflict[]): TaskCurrentEntity[] {
  const grouped = new Map<string, TaskProjectionConflict[]>();
  for (const conflict of conflicts) {
    const key = `${conflict.entityType}\u0000${conflict.entityId}`;
    const values = grouped.get(key) ?? [];
    values.push(conflict);
    grouped.set(key, values);
  }
  return [...grouped.values()].map((values) => {
    const first = values[0];
    const replicaId = (conflictIndex: number, candidateIndex: number): string => `migration:${projectId}:${first.entityType}:${first.entityId}:${conflictIndex}:${candidateIndex}`;
    const clock = Object.fromEntries(['baseline', ...values.flatMap((conflict, conflictIndex) => conflict.candidates.map((_candidate, candidateIndex) => replicaId(conflictIndex, candidateIndex)))].map((id) => [id, 1]));
    return finalizeTaskCurrentEntity({
      version: taskCurrentStateVersion,
      projectId,
      entityType: first.entityType,
      entityId: first.entityId,
      fields: Object.fromEntries(values.map((conflict, conflictIndex) => [conflict.path, {
        clock,
        candidates: conflict.candidates.map((candidate, candidateIndex) => ({
          dot: { replicaId: replicaId(conflictIndex, candidateIndex), counter: 1 },
          operation: candidate.operation,
          ...(Object.hasOwn(candidate, 'value') ? { value: structuredClone(candidate.value) } : {}),
        })),
      }])),
    });
  });
}

function inside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

async function atomicWrite(file: string, value: string | Buffer): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.migration-${process.pid}`;
  await writeFile(temporary, value);
  await rename(temporary, file);
}

export async function migrateTaskCurrentState(input: {
  decisionOsRoot: string;
  projectId: string;
  nodeId: string;
  tasksLedgerFile: string;
  targetEpoch?: number;
  defaultAssignedNodeId?: string;
  backupRoot?: string;
  sourceStateRoots?: string[];
}): Promise<{ backup: string; root: string; baselineRoot: string; report: string }> {
  if (!/^[a-zA-Z0-9_-]+$/.test(input.nodeId)) throw new Error('invalid_task_migration_node_id');
  const targetEpoch = input.targetEpoch ?? taskCurrentBaselineEpoch;
  const defaultAssignedNodeId = input.defaultAssignedNodeId ?? 'workstation';
  if (targetEpoch !== taskCurrentBaselineEpoch) throw new Error(`unsupported_task_migration_target_epoch:${targetEpoch}`);
  if (!/^[a-zA-Z0-9_-]+$/.test(defaultAssignedNodeId)) throw new Error('invalid_task_migration_default_assigned_node_id');
  // WHAT: Reject project identifiers that can escape project-owned storage paths.
  // WHY: Migration derives active-state and rollback paths from this operator-supplied value.
  if (!/^[a-zA-Z0-9_-]+$/.test(input.projectId)) throw new Error('invalid_task_migration_project_id');
  const activeRoot = resolve(input.decisionOsRoot, 'task-state', input.projectId);
  const activeFormatFile = resolve(activeRoot, 'format.json');
  if (existsSync(activeFormatFile)) {
    const activeFormat = JSON.parse(readFileSync(activeFormatFile, 'utf8')) as Record<string, unknown>;
    if (activeFormat.stateSchema === taskCurrentStateVersion) throw new Error('task_current_state_already_migrated');
    if (activeFormat.stateSchema !== 3 && activeFormat.version !== 3 && activeFormat.version !== 2) throw new Error('unsupported_legacy_task_current_state_format');
  }
  const sourceStateRoots = [...new Set([activeRoot, ...(input.sourceStateRoots ?? []).map((root) => resolve(root))])];
  const projectionSources = prepareProjectionSources({
    stateRoots: sourceStateRoots.slice(1),
    projectId: input.projectId,
    decisionOsRoot: input.decisionOsRoot,
    defaultAssignedNodeId,
  });
  const source = projectionSource(sourceStateRoots, input.tasksLedgerFile, input.projectId, input.decisionOsRoot, projectionSources);
  const baselineCounter = migrationCounter(source.legacyEntities, input.nodeId);
  const hydrated = structuredClone(source.ledger ?? {});
  const executions = prepareEpoch4ExecutionMigration({
    decisionOsRoot: input.decisionOsRoot,
    projectId: input.projectId,
    nodeId: input.nodeId,
    defaultAssignedNodeId,
    ledger: hydrated,
  });
  // WHAT: Complete every semantic and relationship check before mutating project files.
  // WHY: A failed preflight must leave the legacy store and sidecars byte-identical.
  const prepared = prepareTaskCurrentStateMigration({
    decisionOsRoot: input.decisionOsRoot,
    ledger: hydrated,
    defaultAssignedNodeId,
  });
  const backup = resolve(input.backupRoot ?? resolve(dirname(input.decisionOsRoot), `${basename(input.decisionOsRoot)}-task-state-rollback`), `${input.projectId}-${new Date().toISOString().replaceAll(':', '-')}`);
  if (inside(input.decisionOsRoot, backup) || backup === resolve(input.decisionOsRoot)) throw new Error('task_migration_backup_must_be_outside_decision_os_root');
  await mkdir(backup, { recursive: true });
  await cp(input.decisionOsRoot, resolve(backup, 'decision-os'), { recursive: true, force: false, errorOnExist: true });
  for (const [index, sourceRoot] of sourceStateRoots.entries()) {
    if (sourceRoot === activeRoot) continue;
    await cp(sourceRoot, resolve(backup, 'source-state-roots', String(index)), { recursive: true, force: false, errorOnExist: true });
  }
  const backedUpSourceRoots = sourceStateRoots.map((sourceRoot, index) => sourceRoot === activeRoot
    ? resolve(backup, 'decision-os', 'task-state', input.projectId)
    : resolve(backup, 'source-state-roots', String(index)));
  await rm(activeRoot, { recursive: true, force: true });
  for (const content of projectionSources.flatMap((source) => source.content)) {
    const file = resolve(input.decisionOsRoot, content.key.replace(/^\/?\.decision-os\//, ''));
    if (!existsSync(file)) await atomicWrite(file, content.bytes);
  }
  for (const rewrite of prepared.bodyRewrites.filter((entry) => entry.removedGeneratedContent)) await atomicWrite(rewrite.file, rewrite.after);
  const ledger = prepared.ledger;
  await atomicWrite(input.tasksLedgerFile, `${JSON.stringify(stripHydratedThreadNotes(structuredClone(ledger)), null, 2)}\n`);

  const store = createTaskCurrentStateStore({
    decisionOsRoot: input.decisionOsRoot,
    projectId: input.projectId,
    initializeLedger: ledger,
    initializeReplica: { replicaId: input.nodeId, counter: baselineCounter },
    deferFormat: true,
  });
  const restoredObjects = await restoreTaskContentObjects(backedUpSourceRoots, store.root);
  const projectionObjects = new Map<string, Buffer>();
  for (const content of projectionSources.flatMap((source) => source.content)) projectionObjects.set(createHash('sha256').update(content.bytes).digest('hex'), content.bytes);
  let installedProjectionObjects = 0;
  let installedProjectionBytes = 0;
  for (const [hash, bytes] of projectionObjects) {
    const file = resolve(store.root, 'objects', hash.slice(0, 2), hash);
    if (existsSync(file)) continue;
    await atomicWrite(file, bytes);
    installedProjectionObjects += 1;
    installedProjectionBytes += bytes.byteLength;
  }
  const objectInventory = {
    sourceObjects: restoredObjects.sourceObjects + projectionObjects.size,
    installedObjects: restoredObjects.installedObjects + installedProjectionObjects,
    installedBytes: restoredObjects.installedBytes + installedProjectionBytes,
  };
  for (const object of executions.objects) {
    const file = resolve(store.root, 'objects', object.hash.slice(0, 2), object.hash);
    if (!existsSync(file)) await atomicWrite(file, object.bytes);
  }
  await mergeEntityBatches(store, input.projectId, projectionSources.flatMap((source) => source.entities));
  await mergeEntityBatches(store, input.projectId, recoveredPresenceEntities(input.projectId, source.legacyEntities, store));
  const conflicts = conflictEntities(input.projectId, (source.conflicts ?? []).filter((conflict) => !isLegacyExecutionCardField(conflict.path)));
  await mergeEntityBatches(store, input.projectId, conflicts);
  await mergeEntityBatches(store, input.projectId, executions.entities);

  const objects = createTaskContentObjectStore({ decisionOsRoot: input.decisionOsRoot, projectId: input.projectId });
  const manifest = buildFederationContentManifest({ projectId: input.projectId, decisionOsRoot: input.decisionOsRoot, ledger });
  const heads = (await Promise.all(manifest.resources.map((resource) => objects.capture(resource.key)))).filter((head) => head !== null);
  await mergeEntityBatches(store, input.projectId, [...baselineResourceEntities(input.projectId, heads, input.nodeId, baselineCounter), ...epochResourceEntities(source.legacyEntities), ...projectionSources.flatMap((source) => source.resourceEntities)]);
  await store.flush();
  if (executions.pipelineFile) await atomicWrite(executions.pipelineFile, `${JSON.stringify(executions.pipelineStore, null, 2)}\n`);
  for (const file of executions.legacyFiles) await rm(file, { force: true });
  for (const head of store.contentHeads()) {
    // WHAT: Fail cutover when a retained source head lacks its immutable bytes.
    // WHY: Publishing the format marker with an unreadable remote-only head would claim semantic preservation falsely.
    if (!existsSync(objects.objectFile(head.hash))) throw new Error(`missing_migrated_task_content_object:${head.hash}:${head.key}`);
  }
  for (const object of executions.objects) {
    const file = resolve(store.root, 'objects', object.hash.slice(0, 2), object.hash);
    if (!existsSync(file)) throw new Error(`missing_migrated_execution_artifact:${object.hash}`);
  }
  const projection = store.projection();
  const currentEntities = store.activeDelta().entities;
  const inventoryEntities = (entities: Array<Pick<TaskCurrentEntity, 'entityType'>>): Record<string, number> => Object.fromEntries(taskEntityTypes.map((entityType) => [entityType, entities.filter((entity) => entity.entityType === entityType).length]));
  const semanticInventory = {
    cards: Array.isArray(ledger.cards) ? ledger.cards.length : 0,
    annotations: Array.isArray(ledger.annotations) ? ledger.annotations.length : 0,
    relationships: Array.isArray(ledger.relationships) ? ledger.relationships.length : 0,
    threadReferences: ledger.threadFiles && typeof ledger.threadFiles === 'object' && !Array.isArray(ledger.threadFiles) ? Object.keys(ledger.threadFiles).length : 0,
    notes: ledger.notes && typeof ledger.notes === 'object' && !Array.isArray(ledger.notes) ? Object.values(ledger.notes).reduce((count, notes) => count + (Array.isArray(notes) ? notes.length : 0), 0) : 0,
    deletions: ledger.deletedNoteIds && typeof ledger.deletedNoteIds === 'object' && !Array.isArray(ledger.deletedNoteIds) ? Object.values(ledger.deletedNoteIds).reduce((count, ids) => count + (Array.isArray(ids) ? ids.length : 0), 0) : 0,
    entityDeletions: currentEntities.filter((entity) => entity.fields.$entity?.candidates.length > 0 && entity.fields.$entity.candidates.every((candidate) => candidate.operation === 'tombstone')).length,
    resourceHeads: store.contentHeads().length,
    conflicts: projection.conflicts.length,
  };
  const report = resolve(store.root, 'migration-report.json');
  await atomicWrite(report, `${JSON.stringify({
    version: 1,
    stateProtocol: taskStateProtocol,
    stateSchema: taskCurrentStateVersion,
    baselineEpoch: taskCurrentBaselineEpoch,
    projectId: input.projectId,
    nodeId: input.nodeId,
    defaultAssignedNodeId,
    baselineCounter,
    backup,
    sourceValueAudit: prepared.lifecycleAudit,
    assignmentAudit: prepared.assignmentAudit,
    assignmentCoverage: {
      assignedTasks: prepared.assignmentAudit.filter((entry) => !entry.inherited && entry.assignedNodeId === defaultAssignedNodeId).length,
      inheritedSubtasks: prepared.assignmentAudit.filter((entry) => entry.inherited).length,
      missingAssignments: prepared.assignmentAudit.filter((entry) => !entry.inherited && !entry.assignedNodeId).map((entry) => entry.cardId),
    },
    executionMigration: executions.report,
    missingObjects: 0,
    bodyRewriteReport: prepared.bodyRewrites.map(({ before, after, ...entry }) => ({ ...entry, beforeHash: createHash('sha256').update(before).digest('hex'), afterHash: createHash('sha256').update(after).digest('hex') })),
    relationshipRepairReport: prepared.relationshipRepairs,
    recoveredNoteDeletions: prepared.recoveredNoteDeletions,
    objectInventory,
    sourceEntityInventory: inventoryEntities([...source.legacyEntities, ...projectionSources.flatMap((source) => [...source.entities, ...source.resourceEntities])]),
    projectionSources: projectionSources.map((source) => ({ sourceNodeId: source.sourceNodeId, entityCount: source.sourceEntityCount, resourceCount: source.resourceEntities.length })),
    currentEntityInventory: inventoryEntities(currentEntities),
    semanticInventory,
    journalCount: store.diagnostics().journalCount,
    canonicalProjectionChecksum: createHash('sha256').update(canonicalJson({ ledger: projection.ledger, conflicts: projection.conflicts })).digest('hex'),
    root: store.rootHash(),
  }, null, 2)}\n`);
  // WHAT: Publish the epoch marker only after shards, objects, sidecars, and audit evidence are durable.
  // WHY: Runtime admission treats the marker as proof that the offline transaction completed.
  await store.commitFormat();
  const format = JSON.parse(readFileSync(store.formatFile, 'utf8')) as { baselineRoot: string };
  return { backup, root: store.root, baselineRoot: format.baselineRoot, report };
}
