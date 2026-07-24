/**
 * WHAT: Performs the one-time offline cutover from the retained v2 projection into causal current-state shards.
 * WHY: The server runtime must never parse, migrate, or dual-write the historical representation.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { buildFederationContentManifestAsync, type FederationContentManifest } from '../../federation/helper/federation-content-manifest.js';
import { hydrateLedgerThreadNotes, stripHydratedThreadNotes } from '../../ledger/helper/thread-content-file.js';
import { canonicalJson } from './task-current-state-codec.js';
import { finalizeTaskCurrentEntity } from './task-current-state-join.js';
import { materializeTaskCurrentEntity } from './materialize-task-current-entity.js';
import { createTaskCurrentStateStore } from './task-current-state-store.js';
import type { TaskContentHead } from './task-content-object-store.js';
import { prepareEpoch4ExecutionMigration } from './prepare-epoch4-execution-migration.js';
import { isLegacyExecutionCardField, prepareTaskCurrentStateMigration as prepareTaskCurrentStateSemantics } from './prepare-task-current-state-migration.js';
import { createTaskCurrentStatePersistence } from './task-current-state-persistence.js';
import { mergeProjectionSourceLedger, prepareProjectionSources, type PreparedProjectionSource } from './task-current-state-projection-sources.js';
import { runTaskCurrentStateMigrationTransaction } from './task-current-state-migration-transaction.js';
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
    const valueRegisters = Object.entries(entity.fields).filter(([path]) => path !== '$entity').map(([, register]) => register);
    const removedValue = valueRegisters.length > 0 && valueRegisters.every((register) => (
      register.candidates.length > 0 && register.candidates.every((candidate) => candidate.operation === 'remove')
    ));
    // WHAT: Convert a stale set-presence plus fully removed value lane into one causal tombstone.
    // WHY: Epoch 3 left ledger-field presence live after removing the field value; rejecting it blocks valid migration,
    // while omitting it would allow an older peer value to resurrect after epoch-4 convergence.
    const operation = currentPresence?.candidates[0]?.operation
      ?? (operations.has('tombstone') || removedValue ? 'tombstone' : 'set');
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

export type TaskCurrentStateMigrationInput = {
  decisionOsRoot: string;
  projectId: string;
  nodeId: string;
  tasksLedgerFile: string;
  targetEpoch?: number;
  defaultAssignedNodeId?: string;
  backupRoot?: string;
  sourceStateRoots?: string[];
  contentObjectRoots?: string[];
};

export type TaskCurrentStateMigrationSnapshot = {
  file: string;
  hash: string;
  bytes: number;
  mode: number;
  archive: boolean;
};

export type TaskCurrentStateMigrationSidecar = {
  file: string;
  before: Buffer | null;
  value: Buffer | null;
};

export type TaskCurrentStateMigrationPlan = {
  decisionOsRoot: string;
  projectId: string;
  nodeId: string;
  defaultAssignedNodeId: string;
  activeRoot: string;
  sourceStateRoots: string[];
  contentObjectSources: Array<{ hash: string; file: string; bytes: number }>;
  source: MigrationSource;
  projectionSources: PreparedProjectionSource[];
  baselineCounter: number;
  prepared: ReturnType<typeof prepareTaskCurrentStateSemantics>;
  executions: ReturnType<typeof prepareEpoch4ExecutionMigration>;
  manifest: FederationContentManifest;
  sidecars: TaskCurrentStateMigrationSidecar[];
  sourceSnapshots: TaskCurrentStateMigrationSnapshot[];
  sourceFingerprint: string;
};

export type TaskCurrentStateMigrationBuild = {
  plan: TaskCurrentStateMigrationPlan;
  shadowDecisionOsRoot: string;
  shadowRoot: string;
  baselineRoot: string;
  report: string;
};

async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file, { highWaterMark: 256 * 1024 })) hash.update(chunk);
  return hash.digest('hex');
}

async function filesBelow(root: string, excludeObjects = false): Promise<string[]> {
  if (!existsSync(root)) return [];
  const output: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      const inner = relative(root, file);
      if (excludeObjects && (inner === 'objects' || inner.startsWith(`objects/`))) continue;
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) output.push(file);
    }
  };
  await visit(root);
  return output.sort();
}

async function sourceSnapshots(input: {
  decisionOsRoot: string;
  activeRoot: string;
  sourceStateRoots: string[];
  sidecars: TaskCurrentStateMigrationSidecar[];
  manifest: FederationContentManifest;
  contentObjectSources: Array<{ hash: string; file: string; bytes: number }>;
}): Promise<TaskCurrentStateMigrationSnapshot[]> {
  const files = new Map<string, { archive: boolean; knownHash?: string; knownBytes?: number }>();
  const include = (file: string, archive: boolean, knownHash?: string, knownBytes?: number): void => {
    const current = files.get(file);
    const retained = Boolean(current?.archive || archive);
    files.set(file, {
      archive: retained,
      knownHash: retained ? undefined : current?.knownHash ?? knownHash,
      knownBytes: retained ? undefined : current?.knownBytes ?? knownBytes,
    });
  };
  for (const file of await filesBelow(input.activeRoot, true)) include(file, true);
  for (const root of input.sourceStateRoots.slice(1)) {
    for (const file of await filesBelow(root, true)) include(file, true);
  }
  for (const sidecar of input.sidecars) if (sidecar.before) include(sidecar.file, true);
  for (const resource of input.manifest.resources) {
    const file = resolve(input.decisionOsRoot, resource.key.replace(/^\/?\.decision-os\//, ''));
    include(file, false, resource.hash, resource.bytes);
  }
  for (const source of input.contentObjectSources) include(source.file, false, source.hash, source.bytes);
  const snapshots: TaskCurrentStateMigrationSnapshot[] = [];
  for (const [file, value] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
    if (!existsSync(file)) throw new Error(`task_migration_source_disappeared:${file}`);
    const metadata = statSync(file);
    if (!metadata.isFile()) throw new Error(`task_migration_source_not_file:${file}`);
    snapshots.push({
      file,
      hash: value.knownHash ?? await sha256(file),
      bytes: value.knownBytes ?? metadata.size,
      mode: metadata.mode & 0o777,
      archive: value.archive,
    });
  }
  return snapshots;
}

function legacyContentHashes(entities: LegacyEntity[]): string[] {
  const hashes = new Set<string>();
  for (const entity of entities) {
    if (entity.entityType !== 'resource') continue;
    for (const register of Object.values(entity.fields)) {
      for (const candidate of register.candidates) {
        if (candidate.operation !== 'set' || !candidate.value || typeof candidate.value !== 'object') continue;
        const hash = String((candidate.value as Record<string, unknown>).hash ?? '');
        if (/^[a-f0-9]{64}$/.test(hash)) hashes.add(hash);
      }
    }
  }
  return [...hashes].sort();
}

export async function verifyTaskCurrentStateMigrationPlan(plan: TaskCurrentStateMigrationPlan): Promise<void> {
  for (const snapshot of plan.sourceSnapshots) {
    if (!existsSync(snapshot.file)) throw new Error(`task_migration_source_drift:${snapshot.file}:missing`);
    const metadata = statSync(snapshot.file);
    if (!metadata.isFile() || metadata.size !== snapshot.bytes || (metadata.mode & 0o777) !== snapshot.mode || await sha256(snapshot.file) !== snapshot.hash) {
      throw new Error(`task_migration_source_drift:${snapshot.file}:changed`);
    }
  }
}

export async function prepareTaskCurrentStateMigrationPlan(input: TaskCurrentStateMigrationInput): Promise<TaskCurrentStateMigrationPlan> {
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
  const contentObjectSources = await prepareContentObjectSources({
    hashes: legacyContentHashes(source.legacyEntities),
    sourceStateRoots,
    contentObjectRoots: [...new Set((input.contentObjectRoots ?? []).map((root) => resolve(root)))],
  });
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
  const prepared = prepareTaskCurrentStateSemantics({
    decisionOsRoot: input.decisionOsRoot,
    ledger: hydrated,
    defaultAssignedNodeId,
  });
  const overrides = new Map(prepared.bodyRewrites
    .filter((entry) => entry.removedGeneratedContent)
    .map((entry) => [entry.contentFile.replace(/^\//, ''), Buffer.from(entry.after)]));
  const manifest = await buildFederationContentManifestAsync({
    projectId: input.projectId,
    decisionOsRoot: input.decisionOsRoot,
    ledger: prepared.ledger,
    overrides,
  });
  const mutations = new Map<string, Buffer | null>();
  for (const content of projectionSources.flatMap((source) => source.content)) {
    const file = resolve(input.decisionOsRoot, content.key.replace(/^\/?\.decision-os\//, ''));
    if (!existsSync(file)) mutations.set(file, content.bytes);
  }
  for (const rewrite of prepared.bodyRewrites.filter((entry) => entry.removedGeneratedContent)) mutations.set(rewrite.file, Buffer.from(rewrite.after));
  const ledger = prepared.ledger;
  mutations.set(input.tasksLedgerFile, Buffer.from(`${JSON.stringify(stripHydratedThreadNotes(structuredClone(ledger)), null, 2)}\n`));
  if (executions.pipelineFile) mutations.set(executions.pipelineFile, Buffer.from(`${JSON.stringify(executions.pipelineStore, null, 2)}\n`));
  for (const file of executions.legacyFiles) mutations.set(file, null);
  const sidecars = [...mutations].sort(([left], [right]) => left.localeCompare(right)).map(([file, value]) => ({
    file,
    before: existsSync(file) ? readFileSync(file) : null,
    value,
  }));
  for (const sidecar of sidecars) {
    if (!inside(input.decisionOsRoot, sidecar.file)) throw new Error(`task_migration_sidecar_outside_project:${sidecar.file}`);
  }
  const snapshots = await sourceSnapshots({ decisionOsRoot: input.decisionOsRoot, activeRoot, sourceStateRoots, sidecars, manifest, contentObjectSources });
  const sourceFingerprint = createHash('sha256').update(canonicalJson(snapshots.map(({ file, hash, bytes, mode }) => ({ file, hash, bytes, mode })))).digest('hex');
  return {
    decisionOsRoot: resolve(input.decisionOsRoot),
    projectId: input.projectId,
    nodeId: input.nodeId,
    defaultAssignedNodeId,
    activeRoot,
    sourceStateRoots,
    contentObjectSources,
    source,
    projectionSources,
    baselineCounter,
    prepared,
    executions,
    manifest,
    sidecars,
    sourceSnapshots: snapshots,
    sourceFingerprint,
  };
}

async function installObject(file: string, bytes: Buffer): Promise<void> {
  if (existsSync(file)) return;
  await createTaskCurrentStatePersistence(dirname(file)).atomicWrite(file, bytes);
}

async function sourceObject(sourceRoots: string[], hash: string): Promise<string> {
  for (const root of sourceRoots) {
    const file = resolve(root, 'objects', hash.slice(0, 2), hash);
    if (!existsSync(file)) continue;
    if (await sha256(file) !== hash) throw new Error(`invalid_task_content_object_hash:${file}`);
    return file;
  }
  return '';
}

async function prepareContentObjectSources(input: {
  hashes: string[];
  sourceStateRoots: string[];
  contentObjectRoots: string[];
}): Promise<Array<{ hash: string; file: string; bytes: number }>> {
  const sources: Array<{ hash: string; file: string; bytes: number }> = [];
  for (const hash of input.hashes) {
    if (await sourceObject(input.sourceStateRoots, hash)) continue;
    for (const root of input.contentObjectRoots) {
      const file = resolve(root, hash.slice(0, 2), hash);
      if (!existsSync(file)) continue;
      if (await sha256(file) !== hash) throw new Error(`invalid_task_content_object_hash:${file}`);
      sources.push({ hash, file, bytes: statSync(file).size });
      break;
    }
  }
  return sources;
}

export async function buildTaskCurrentStateMigrationShadow(plan: TaskCurrentStateMigrationPlan, shadowDecisionOsRoot: string, backup: string): Promise<TaskCurrentStateMigrationBuild> {
  if (inside(plan.decisionOsRoot, shadowDecisionOsRoot) || resolve(plan.decisionOsRoot) === resolve(shadowDecisionOsRoot)) {
    throw new Error('task_migration_shadow_must_be_outside_decision_os_root');
  }
  await rm(shadowDecisionOsRoot, { recursive: true, force: true });
  await mkdir(shadowDecisionOsRoot, { recursive: true });
  const ledger = plan.prepared.ledger;
  const store = createTaskCurrentStateStore({
    decisionOsRoot: shadowDecisionOsRoot,
    projectId: plan.projectId,
    initializeLedger: ledger,
    initializeReplica: { replicaId: plan.nodeId, counter: plan.baselineCounter },
    deferFormat: true,
  });
  const projectionObjects = new Map<string, Buffer>();
  for (const content of plan.projectionSources.flatMap((source) => source.content)) projectionObjects.set(createHash('sha256').update(content.bytes).digest('hex'), content.bytes);
  for (const object of plan.executions.objects) {
    const file = resolve(store.root, 'objects', object.hash.slice(0, 2), object.hash);
    await installObject(file, object.bytes);
  }
  await mergeEntityBatches(store, plan.projectId, plan.projectionSources.flatMap((source) => source.entities));
  await mergeEntityBatches(store, plan.projectId, recoveredPresenceEntities(plan.projectId, plan.source.legacyEntities, store));
  const conflicts = conflictEntities(plan.projectId, (plan.source.conflicts ?? []).filter((conflict) => !isLegacyExecutionCardField(conflict.path)));
  await mergeEntityBatches(store, plan.projectId, conflicts);
  await mergeEntityBatches(store, plan.projectId, plan.executions.entities);
  const heads = plan.manifest.resources as TaskContentHead[];
  await mergeEntityBatches(store, plan.projectId, [
    ...baselineResourceEntities(plan.projectId, heads, plan.nodeId, plan.baselineCounter),
    ...epochResourceEntities(plan.source.legacyEntities),
    ...plan.projectionSources.flatMap((source) => source.resourceEntities),
  ]);
  await store.flush();
  let installedObjects = 0;
  let installedBytes = 0;
  let missingObjects = 0;
  const deferredRemoteObjects: Array<{ key: string; hash: string; bytes: number; sourceReplicaId: string }> = [];
  const localHeads = new Set(plan.manifest.resources.map((resource) => `${resource.key}\u0000${resource.hash}`));
  for (const head of store.contentHeads()) {
    if (localHeads.has(`${head.key}\u0000${head.hash}`)) continue;
    const target = resolve(store.root, 'objects', head.hash.slice(0, 2), head.hash);
    if (existsSync(target)) continue;
    const projectionBytes = projectionObjects.get(head.hash);
    if (projectionBytes) {
      await installObject(target, projectionBytes);
      installedObjects += 1;
      installedBytes += projectionBytes.byteLength;
      continue;
    }
    const source = await sourceObject(plan.sourceStateRoots, head.hash)
      || plan.contentObjectSources.find((entry) => entry.hash === head.hash)?.file
      || '';
    if (source) {
      await mkdir(dirname(target), { recursive: true });
      await copyFile(source, target);
      installedObjects += 1;
      installedBytes += statSync(target).size;
      continue;
    }
    if (head.sourceReplicaId !== plan.nodeId) {
      // WHAT: Preserve a remote causal head when this node has not materialized its immutable bytes.
      // WHY: Epoch-4 content reads already fetch exact remote hashes on demand; cutover must not duplicate or invent unavailable media.
      deferredRemoteObjects.push({ key: head.key, hash: head.hash, bytes: head.bytes, sourceReplicaId: head.sourceReplicaId });
      continue;
    }
    missingObjects += 1;
    throw new Error(`missing_migrated_task_content_object:${head.hash}:${head.key}`);
  }
  for (const object of plan.executions.objects) {
    const file = resolve(store.root, 'objects', object.hash.slice(0, 2), object.hash);
    if (!existsSync(file)) throw new Error(`missing_migrated_execution_artifact:${object.hash}`);
  }
  await createTaskCurrentStatePersistence(store.root).atomicWrite(resolve(store.root, 'content-manifest.json'), `${JSON.stringify(plan.manifest, null, 2)}\n`);
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
  await createTaskCurrentStatePersistence(store.root).atomicWrite(report, `${JSON.stringify({
    version: 1,
    stateProtocol: taskStateProtocol,
    stateSchema: taskCurrentStateVersion,
    baselineEpoch: taskCurrentBaselineEpoch,
    projectId: plan.projectId,
    nodeId: plan.nodeId,
    defaultAssignedNodeId: plan.defaultAssignedNodeId,
    baselineCounter: plan.baselineCounter,
    backup,
    sourceFingerprint: plan.sourceFingerprint,
    sourceValueAudit: plan.prepared.lifecycleAudit,
    assignmentAudit: plan.prepared.assignmentAudit,
    assignmentCoverage: {
      assignedTasks: plan.prepared.assignmentAudit.filter((entry) => !entry.inherited && entry.assignedNodeId === plan.defaultAssignedNodeId).length,
      inheritedSubtasks: plan.prepared.assignmentAudit.filter((entry) => entry.inherited).length,
      missingAssignments: plan.prepared.assignmentAudit.filter((entry) => !entry.inherited && !entry.assignedNodeId).map((entry) => entry.cardId),
    },
    executionMigration: plan.executions.report,
    missingObjects,
    deferredRemoteObjects,
    bodyRewriteReport: plan.prepared.bodyRewrites.map(({ before, after, ...entry }) => ({ ...entry, beforeHash: createHash('sha256').update(before).digest('hex'), afterHash: createHash('sha256').update(after).digest('hex') })),
    relationshipRepairReport: plan.prepared.relationshipRepairs,
    recoveredNoteDeletions: plan.prepared.recoveredNoteDeletions,
    objectInventory: {
      referencedObjects: store.contentHeads().length,
      installedObjects,
      installedBytes,
      deferredRemoteObjects: deferredRemoteObjects.length,
      referencedWorkspaceBytes: plan.manifest.resources.reduce((sum, resource) => sum + resource.bytes, 0),
    },
    sourceEntityInventory: inventoryEntities([...plan.source.legacyEntities, ...plan.projectionSources.flatMap((source) => [...source.entities, ...source.resourceEntities])]),
    projectionSources: plan.projectionSources.map((source) => ({ sourceNodeId: source.sourceNodeId, entityCount: source.sourceEntityCount, resourceCount: source.resourceEntities.length })),
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
  return { plan, shadowDecisionOsRoot, shadowRoot: store.root, baselineRoot: format.baselineRoot, report };
}

export async function migrateTaskCurrentState(input: TaskCurrentStateMigrationInput): Promise<{ backup: string; root: string; baselineRoot: string; report: string }> {
  const backupParent = resolve(input.backupRoot ?? resolve(dirname(input.decisionOsRoot), `${basename(input.decisionOsRoot)}-task-state-rollback`));
  if (inside(input.decisionOsRoot, backupParent) || backupParent === resolve(input.decisionOsRoot)) throw new Error('task_migration_backup_must_be_outside_decision_os_root');
  const backup = resolve(backupParent, `${input.projectId}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`);
  const plan = await prepareTaskCurrentStateMigrationPlan(input);
  return runTaskCurrentStateMigrationTransaction({
    backupRoot: backup,
    plans: [plan],
    build: buildTaskCurrentStateMigrationShadow,
  }).then((result) => result.projects[0]);
}
