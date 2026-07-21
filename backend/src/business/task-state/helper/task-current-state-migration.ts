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
import { createTaskContentObjectStore } from './task-content-object-store.js';
import { prepareTaskCurrentStateMigration } from './prepare-task-current-state-migration.js';
import { joinTaskRegisters } from '../../../../../shared/task-current-state-core.js';
import { taskCurrentStateVersion, taskEntityTypes, type TaskCurrentEntity, type TaskCurrentProjection, type TaskCurrentRegister, type TaskProjectionConflict } from './task-current-state-types.js';

type MigrationProjection = { projectId?: string; ledger?: Record<string, unknown>; conflicts?: TaskProjectionConflict[] };
type LegacyEntity = Omit<TaskCurrentEntity, 'version'> & { version: 2; fields: Record<string, TaskCurrentRegister> };

function legacyCurrentProjection(stateRoots: string[], projectId: string): MigrationProjection | null {
  const joined = new Map<string, LegacyEntity>();
  for (const stateRoot of stateRoots) {
    for (const entityType of taskEntityTypes) {
      const directory = resolve(stateRoot, 'current', entityType);
      if (!existsSync(directory)) continue;
      for (const name of readdirSync(directory).filter((entry) => entry.endsWith('.json')).sort()) {
        const entity = JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as LegacyEntity;
        if (entity.version !== 2 || entity.projectId !== projectId || entity.entityType !== entityType || !entity.entityId) throw new Error(`invalid_legacy_task_entity:${stateRoot}:${entityType}:${name}`);
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
  return projection;
}

function projectionSource(stateRoots: string[], tasksLedgerFile: string, projectId: string): MigrationProjection {
  const current = legacyCurrentProjection(stateRoots, projectId);
  if (current) return current;
  const stateRoot = stateRoots[0];
  const projectionFile = resolve(stateRoot, 'projection.json');
  if (existsSync(projectionFile)) {
    const projection = JSON.parse(readFileSync(projectionFile, 'utf8')) as MigrationProjection;
    if (projection.ledger && typeof projection.ledger === 'object') return projection;
  }
  return { ledger: JSON.parse(readFileSync(tasksLedgerFile, 'utf8')) as Record<string, unknown>, conflicts: [] };
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

async function atomicWrite(file: string, value: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.migration-${process.pid}`;
  await writeFile(temporary, value);
  await rename(temporary, file);
}

export async function migrateTaskCurrentState(input: { decisionOsRoot: string; projectId: string; tasksLedgerFile: string; backupRoot?: string; sourceStateRoots?: string[] }): Promise<{ backup: string; root: string; baselineRoot: string; report: string }> {
  const activeRoot = resolve(input.decisionOsRoot, 'task-state', input.projectId);
  const activeFormatFile = resolve(activeRoot, 'format.json');
  if (existsSync(activeFormatFile)) {
    const activeFormat = JSON.parse(readFileSync(activeFormatFile, 'utf8')) as Record<string, unknown>;
    if (activeFormat.stateSchema === taskCurrentStateVersion) throw new Error('task_current_state_already_migrated');
    if (activeFormat.version !== 2) throw new Error('unsupported_legacy_task_current_state_format');
  }
  const sourceStateRoots = [...new Set([activeRoot, ...(input.sourceStateRoots ?? []).map((root) => resolve(root))])];
  const source = projectionSource(sourceStateRoots, input.tasksLedgerFile, input.projectId);
  const hydrated = hydrateLedgerThreadNotes(structuredClone(source.ledger ?? {}), input.decisionOsRoot);
  // WHAT: Complete every semantic and relationship check before mutating project files.
  // WHY: A failed preflight must leave the legacy store and sidecars byte-identical.
  const prepared = prepareTaskCurrentStateMigration({ decisionOsRoot: input.decisionOsRoot, ledger: hydrated });
  const backup = resolve(input.backupRoot ?? resolve(dirname(input.decisionOsRoot), `${basename(input.decisionOsRoot)}-task-state-rollback`), `${input.projectId}-${new Date().toISOString().replaceAll(':', '-')}`);
  if (inside(input.decisionOsRoot, backup) || backup === resolve(input.decisionOsRoot)) throw new Error('task_migration_backup_must_be_outside_decision_os_root');
  await mkdir(backup, { recursive: true });
  await cp(input.decisionOsRoot, resolve(backup, 'decision-os'), { recursive: true, force: false, errorOnExist: true });
  for (const [index, sourceRoot] of sourceStateRoots.entries()) {
    if (sourceRoot === activeRoot) continue;
    await cp(sourceRoot, resolve(backup, 'source-state-roots', String(index)), { recursive: true, force: false, errorOnExist: true });
  }
  await rm(activeRoot, { recursive: true, force: true });
  for (const rewrite of prepared.bodyRewrites.filter((entry) => entry.removedGeneratedContent)) await atomicWrite(rewrite.file, rewrite.after);
  const ledger = prepared.ledger;
  await atomicWrite(input.tasksLedgerFile, `${JSON.stringify(stripHydratedThreadNotes(structuredClone(ledger)), null, 2)}\n`);

  const store = createTaskCurrentStateStore({ decisionOsRoot: input.decisionOsRoot, projectId: input.projectId, initializeLedger: ledger, deferFormat: true });
  const conflicts = conflictEntities(input.projectId, source.conflicts ?? []);
  if (conflicts.length > 0) await store.merge({ version: taskCurrentStateVersion, projectId: input.projectId, entities: conflicts });

  const objects = createTaskContentObjectStore({ decisionOsRoot: input.decisionOsRoot, projectId: input.projectId });
  const manifest = buildFederationContentManifest({ projectId: input.projectId, decisionOsRoot: input.decisionOsRoot, ledger });
  const heads = (await Promise.all(manifest.resources.map((resource) => objects.capture(resource.key)))).filter((head) => head !== null);
  if (heads.length > 0) await store.mutate({ replicaId: 'baseline-content', changes: heads.map((head) => ({ entityType: 'resource', entityId: head.key, changes: [{ path: 'head', operation: 'set', value: head }] })) });
  await store.flush();
  const projection = store.projection();
  const semanticInventory = {
    cards: Array.isArray(ledger.cards) ? ledger.cards.length : 0,
    annotations: Array.isArray(ledger.annotations) ? ledger.annotations.length : 0,
    relationships: Array.isArray(ledger.relationships) ? ledger.relationships.length : 0,
    threadReferences: ledger.threadFiles && typeof ledger.threadFiles === 'object' && !Array.isArray(ledger.threadFiles) ? Object.keys(ledger.threadFiles).length : 0,
    notes: ledger.notes && typeof ledger.notes === 'object' && !Array.isArray(ledger.notes) ? Object.values(ledger.notes).reduce((count, notes) => count + (Array.isArray(notes) ? notes.length : 0), 0) : 0,
    deletions: ledger.deletedNoteIds && typeof ledger.deletedNoteIds === 'object' && !Array.isArray(ledger.deletedNoteIds) ? Object.values(ledger.deletedNoteIds).reduce((count, ids) => count + (Array.isArray(ids) ? ids.length : 0), 0) : 0,
    resourceHeads: heads.length,
    conflicts: projection.conflicts.length,
  };
  const report = resolve(store.root, 'migration-report.json');
  await atomicWrite(report, `${JSON.stringify({
    version: 1,
    projectId: input.projectId,
    backup,
    sourceValueAudit: prepared.lifecycleAudit,
    bodyRewriteReport: prepared.bodyRewrites.map(({ before, after, ...entry }) => ({ ...entry, beforeHash: createHash('sha256').update(before).digest('hex'), afterHash: createHash('sha256').update(after).digest('hex') })),
    relationshipRepairReport: prepared.relationshipRepairs,
    recoveredNoteDeletions: prepared.recoveredNoteDeletions,
    semanticInventory,
    canonicalProjectionChecksum: createHash('sha256').update(canonicalJson({ ledger: projection.ledger, conflicts: projection.conflicts })).digest('hex'),
    root: store.rootHash(),
  }, null, 2)}\n`);
  // WHAT: Publish the epoch marker only after shards, objects, sidecars, and audit evidence are durable.
  // WHY: Runtime admission treats the marker as proof that the offline transaction completed.
  await store.commitFormat();
  const format = JSON.parse(readFileSync(store.formatFile, 'utf8')) as { baselineRoot: string };
  return { backup, root: store.root, baselineRoot: format.baselineRoot, report };
}
