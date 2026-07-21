/**
 * WHAT: Builds and caches the global, server-owned Control Room read model.
 * WHY: The browser must not download hydrated ledgers and run histories to reconstruct task state.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { readRepositoryOriginIdentity } from '../../project-sync/helper/repository-sync-status.js';
import type { DecisionOsProject } from './project-catalog.js';
import { compareControlRoomQueueTasks } from './control-room-queue-order.js';
import type { ProjectSyncRun } from '../../project-sync/helper/project-sync-types.js';

type AnyRecord = Record<string, unknown>;
type Dependency = { path: string; size: number; mtimeMs: number; sha256: string };
type Projection = AnyRecord & { schemaVersion: number; projectorVersion: string; revision: number; generatedAt: string; fingerprint: string };
type ProjectSlice = { projectId: string; project: AnyRecord; tasks: AnyRecord[]; dependencies: Dependency[]; fingerprint: string };
type ProjectionEntityChange = { entityType: string; entityId: string };

const schemaVersion = 8;
const projectorVersion = 'control-room-v15-structural-task-state';
const taskMaterializationBatchSize = 64;

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function dependency(file: string): Dependency | null {
  if (!existsSync(file)) return null;
  const stat = statSync(file);
  if (!stat.isFile()) return null;
  return { path: file, size: stat.size, mtimeMs: stat.mtimeMs, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') };
}

function overlapArea(card: AnyRecord, zone: AnyRecord): number {
  const left = Number(card.x ?? 0), top = Number(card.y ?? 0);
  const width = Math.max(0, Number(card.w ?? card.width ?? 280)), height = Math.max(0, Number(card.h ?? card.height ?? 132));
  const zoneLeft = Number(zone.x ?? 0), zoneTop = Number(zone.y ?? 0);
  const zoneWidth = Math.max(0, Number(zone.width ?? zone.w ?? 0)), zoneHeight = Math.max(0, Number(zone.height ?? zone.h ?? 0));
  if (![left, top, width, height, zoneLeft, zoneTop, zoneWidth, zoneHeight].every(Number.isFinite)) return 0;
  return Math.max(0, Math.min(left + width, zoneLeft + zoneWidth) - Math.max(left, zoneLeft))
    * Math.max(0, Math.min(top + height, zoneTop + zoneHeight) - Math.max(top, zoneTop));
}

function zoneIdFor(card: AnyRecord, ledger: AnyRecord): string {
  let selected = 'ungrouped';
  let selectedArea = 0;
  for (const zone of records(ledger.annotations).filter((entry) => entry.variant !== 'group' && typeof entry.color === 'string')) {
    const area = overlapArea(card, zone);
    if (area <= selectedArea) continue;
    selected = text(zone.id) || 'ungrouped';
    selectedArea = area;
  }
  return selected;
}

function taskFrom(input: { project: DecisionOsProject; ledgerEntry: DecisionOsProject['ledgers'][number]; ledger: AnyRecord; card: AnyRecord; conflicts?: AnyRecord[] }): AnyRecord | null {
  const jsonLabels = Array.isArray(input.card.labels) ? input.card.labels.map(String) : [];
  if (!jsonLabels.includes('master-task')) return null;
  const lifecycle = input.card.lifecycle && typeof input.card.lifecycle === 'object' && !Array.isArray(input.card.lifecycle) ? input.card.lifecycle as AnyRecord : {};
  const executionIntent = input.card.executionIntent && typeof input.card.executionIntent === 'object' && !Array.isArray(input.card.executionIntent) ? input.card.executionIntent as AnyRecord : {};
  const lifecycleStatus = text(lifecycle.status);
  const executionState = text(executionIntent.state);
  const executionActive = ['waiting', 'queued', 'running'].includes(executionState);
  const waitingSince = text(lifecycle.waitingAt);
  const completedAt = text(lifecycle.closedAt);
  const waitingTime = Date.parse(waitingSince);
  const completedTime = Date.parse(completedAt);
  const cards = records(input.ledger.cards);
  const relationships = records(input.ledger.relationships)
    .filter((relationship) => text(relationship.from) === text(input.card.id) && text(relationship.label) === 'subtask')
    .sort((left, right) => Number(left.position) - Number(right.position) || text(left.id).localeCompare(text(right.id)));
  const status = executionActive ? 'task-execution' : lifecycleStatus === 'backlog' ? 'task-backlog' : lifecycleStatus === 'done' ? 'task-complete' : 'task-waiting';
  const labels = [...new Set(jsonLabels.map((label) => label.trim()).filter((label) => label && label !== 'master-task' && label !== 'subtask'))];
  const subtasks: AnyRecord[] = [];
  for (const relationship of relationships) {
    const cardId = text(relationship.to);
    const linked = cards.find((card) => text(card.id) === cardId);
    const childLifecycle = linked?.lifecycle && typeof linked.lifecycle === 'object' && !Array.isArray(linked.lifecycle) ? linked.lifecycle as AnyRecord : {};
    subtasks.push({ title: text(linked?.title) || `Card ${cardId}`, cardId, relationshipId: text(relationship.id), position: Number(relationship.position), status: childLifecycle.status === 'done' ? 'complete' : 'waiting', zoneId: linked ? zoneIdFor(linked, input.ledger) : 'ungrouped' });
  }
  const diagnostics: string[] = [];
  if (!['todo', 'backlog', 'done'].includes(lifecycleStatus)) diagnostics.push('invalid_lifecycle');
  for (const relationship of relationships) {
    if (!Number.isInteger(Number(relationship.position)) || Number(relationship.position) < 0) diagnostics.push(`invalid_subtask_position:${text(relationship.id)}`);
    if (!cards.some((card) => text(card.id) === text(relationship.to))) diagnostics.push(`missing_subtask:${text(relationship.to)}`);
  }
  const taskIds = new Set([text(input.card.id), ...relationships.map((relationship) => text(relationship.to))]);
  const taskConflicts = records(input.conflicts).filter((conflict) => conflict.kind === 'task-conflict' && conflict.path === 'lifecycle' && taskIds.has(text(conflict.entityId)));
  if (taskConflicts.length > 0) diagnostics.push(...taskConflicts.map((conflict) => `task-conflict:${text(conflict.entityId)}`));
  const complete = subtasks.filter((subtask) => subtask.status === 'complete').length;
  const executionSince = executionActive ? text(executionIntent.startedAt) || text(executionIntent.changedAt) : '';
  return {
    valid: diagnostics.length === 0, masterTask: true, diagnostics,
    cardId: text(input.card.id), title: text(input.card.title) || `Card ${text(input.card.id)}`, labels,
    cardStatus: lifecycleStatus, createdAt: text(input.card.createdAt), lifecycle: structuredClone(lifecycle), executionIntent: structuredClone(executionIntent), taskConflict: taskConflicts.length > 0,
    projectId: input.project.id, projectName: input.project.name, projectColor: input.project.color,
    ledgerId: input.ledgerEntry.id, ledgerTitle: input.ledgerEntry.title, ledger: input.ledgerEntry.title,
    zoneId: zoneIdFor(input.card, input.ledger), status,
    codexRunId: '', codexPipelineRunId: '', codexStatus: executionState,
    executionOwnerCardId: executionActive ? text(input.card.id) : '', executionOwnerKind: executionActive ? 'master-task' : '',
    executionStatus: executionActive ? executionState : '', executionObservation: null,
    transcribingBeforeLaunch: false,
    codexProcessing: executionState === 'running', codexQueued: executionState === 'queued', codexQueuePosition: null,
    waitingSince,
    waitingTime, executionSince,
    executionTime: Date.parse(executionSince),
    completedAt: Number.isFinite(completedTime) ? completedAt : '',
    completedTime: Number.isFinite(completedTime) ? completedTime : null,
    subtasks, complete, nextSubtask: subtasks.find((subtask) => subtask.status !== 'complete') ?? null,
  };
}

function compareTasks(left: AnyRecord, right: AnyRecord): number {
  return (Number.isFinite(left.waitingTime) ? Number(left.waitingTime) : Number.POSITIVE_INFINITY)
    - (Number.isFinite(right.waitingTime) ? Number(right.waitingTime) : Number.POSITIVE_INFINITY)
    || text(left.cardId).localeCompare(text(right.cardId));
}

/** Builds the Control Room slice directly from a worker-owned task projection. */
export function controlRoomProjectionFromTaskLedger(input: { project: DecisionOsProject; ledger: AnyRecord; conflicts?: AnyRecord[]; runtime?: AnyRecord }): AnyRecord {
  const ledgerEntry = input.project.ledgers.find((entry) => entry.id === 'tasks') ?? { id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' };
  const tasks = records(input.ledger.cards).flatMap((card) => {
    const task = taskFrom({ project: input.project, ledgerEntry, ledger: input.ledger, card, conflicts: input.conflicts });
    return task ? [task] : [];
  });
  return {
    queue: tasks.filter((task) => task.status === 'task-waiting'),
    exec: tasks.filter((task) => task.status === 'task-execution'),
    backlog: tasks.filter((task) => task.status === 'task-backlog'),
    done: tasks.filter((task) => task.status === 'task-complete'),
    allTasks: tasks,
    projects: [{ id: input.project.id, name: input.project.name, color: input.project.color, ledgers: input.project.ledgers, originFingerprint: input.project.originFingerprint }],
    ledgers: ['Tasks'],
    diagnostics: tasks.filter((task) => task.valid === false),
    fingerprint: createHash('sha256').update(JSON.stringify({ projectId: input.project.id, ledger: input.ledger, conflicts: input.conflicts ?? [] })).digest('hex'),
  };
}

function projectSyncTask(run: ProjectSyncRun, canonical?: AnyRecord): AnyRecord {
  const failed = run.phase === 'failed';
  const attached = Boolean(canonical);
  const diagnostics = [
    ...(Array.isArray(canonical?.diagnostics) ? canonical.diagnostics.map(String).filter(Boolean) : []),
    ...(run.error?.message ? [run.error.message] : []),
  ];
  return {
    ...(canonical ?? {}),
    valid: !failed,
    masterTask: true,
    diagnostics,
    labels: attached && Array.isArray(canonical?.labels) ? canonical.labels : [],
    cardId: attached ? text(canonical?.cardId) : `project-sync-${run.syncId}`,
    title: attached ? text(canonical?.title) : `Synchronize ${run.sourceProjectName}`,
    cardStatus: attached ? text(canonical?.cardStatus) || 'todo' : 'todo',
    projectId: attached ? text(canonical?.projectId) : run.sourceProjectId,
    projectName: attached ? text(canonical?.projectName) || run.sourceProjectName : run.sourceProjectName,
    projectColor: run.sourceProjectColor,
    ledgerId: attached ? text(canonical?.ledgerId) : 'project-sync',
    ledgerTitle: attached ? text(canonical?.ledgerTitle) : 'Synchronization',
    ledger: attached ? text(canonical?.ledger) : 'Synchronization',
    zoneId: attached ? text(canonical?.zoneId) : 'project-sync',
    status: run.phase === 'complete' ? (attached ? canonical?.status ?? 'task-waiting' : 'task-waiting') : 'task-execution',
    executionStatus: failed ? 'failed' : run.phase === 'complete' ? '' : 'running',
    executionSince: run.createdAt,
    executionTime: Date.parse(run.createdAt),
    waitingSince: run.createdAt,
    waitingTime: Date.parse(run.createdAt),
    subtasks: attached ? canonical?.subtasks ?? [] : [],
    complete: attached ? canonical?.complete ?? 0 : 0,
    nextSubtask: attached ? canonical?.nextSubtask ?? null : null,
    projectSync: true,
    projectSyncCanonical: attached,
    projectSyncId: run.syncId,
    projectSyncPhase: run.phase,
    projectSyncPreparationPhase: run.preparationPhase,
    projectSyncFailed: failed,
    ownerNodeId: run.initiatorNodeId,
  };
}

export function withProjectSyncRuns(projection: AnyRecord, runs: ProjectSyncRun[]): AnyRecord {
  const tasks = records(projection.allTasks).map((task) => ({ ...task }));
  for (const run of runs) {
    const canonicalIndex = run.masterCardId
      ? tasks.findIndex((task) => text(task.cardId) === run.masterCardId && text(task.ledgerId) === run.ledgerId)
      : -1;
    const canonical = canonicalIndex >= 0 ? tasks[canonicalIndex] : undefined;
    const synchronized = projectSyncTask(run, canonical);
    if (canonicalIndex >= 0) tasks[canonicalIndex] = synchronized;
    else tasks.push(synchronized);
  }
  const queue = tasks.filter((task) => task.status === 'task-waiting').sort(compareControlRoomQueueTasks);
  const exec = tasks.filter((task) => task.status === 'task-execution').sort(compareTasks);
  const backlog = tasks.filter((task) => task.status === 'task-backlog').sort(compareTasks);
  const done = tasks.filter((task) => task.status === 'task-complete').sort(compareTasks);
  const runFingerprint = runs.map((run) => [run.syncId, run.updatedAt, run.phase, run.preparationPhase, run.masterCardId]);
  return {
    ...projection,
    fingerprint: createHash('sha256').update(JSON.stringify([projection.fingerprint, runFingerprint])).digest('hex'),
    queue,
    exec,
    backlog,
    done,
    allTasks: tasks,
    ledgers: Array.from(new Set([...(Array.isArray(projection.ledgers) ? projection.ledgers.map(String) : []), ...tasks.map((task) => text(task.ledger))].filter(Boolean))).sort(),
  };
}

function sliceFingerprint(slice: Pick<ProjectSlice, 'projectId' | 'project' | 'dependencies' | 'tasks'>): string {
  return createHash('sha256').update(JSON.stringify({
    projectId: slice.projectId,
    originFingerprint: text(slice.project.originFingerprint),
    schemaVersion,
    projectorVersion,
    dependencies: slice.dependencies.map(({ path, sha256 }) => ({ path, sha256 })),
    tasks: slice.tasks,
  })).digest('hex');
}

function buildProjectSlice(input: { project: DecisionOsProject; taskProjection: AnyRecord; onTaskMaterialized?: () => void }): ProjectSlice {
  const tasks: AnyRecord[] = [];
  const dependencies: Dependency[] = [];
  const project = input.project;
  for (const metadataFile of [resolve(project.decisionOsRoot, 'state.json'), resolve(project.decisionOsRoot, 'project.json')]) {
    const metadataDependency = dependency(metadataFile);
    if (metadataDependency) dependencies.push(metadataDependency);
  }
  for (const ledgerEntry of project.ledgers.filter((entry) => entry.id === 'tasks')) {
      const projectedLedger = input.taskProjection?.ledger && typeof input.taskProjection.ledger === 'object' && !Array.isArray(input.taskProjection.ledger)
        ? input.taskProjection.ledger as AnyRecord
        : input.taskProjection;
      if (!projectedLedger) throw new Error(`Task projection unavailable for project ${project.id}.`);
      const ledger = structuredClone(projectedLedger);
      for (const card of records(ledger.cards)) {
        const task = taskFrom({ project, ledgerEntry, ledger, card, conflicts: records(input.taskProjection?.conflicts) });
        input.onTaskMaterialized?.();
        if (task) tasks.push(task);
      }
  }
  dependencies.sort((left, right) => left.path.localeCompare(right.path));
  let originFingerprint = '';
  try { originFingerprint = readRepositoryOriginIdentity(project.root).originFingerprint; } catch { /* Non-Git projects retain node-local identity. */ }
  const slice = {
    projectId: project.id,
    project: { id: project.id, name: project.name, color: project.color, ledgers: project.ledgers, originFingerprint },
    tasks,
    dependencies,
  };
  return { ...slice, fingerprint: sliceFingerprint(slice) };
}

function affectedTaskIds(slice: ProjectSlice, ledger: AnyRecord, entities: ProjectionEntityChange[]): Set<string> | null {
  const taskIds = new Set<string>();
  const relationships = records(ledger.relationships);
  for (const entity of entities) {
    // WHAT: Content entities never participate in the structural Control Room projection.
    // WHY: Body and thread delivery must not trigger task materialization.
    if (entity.entityType === 'resource' || entity.entityType === 'thread-note') continue;
    if (entity.entityType === 'card') {
      taskIds.add(entity.entityId);
      for (const relationship of relationships.filter((entry) => text(entry.label) === 'subtask' && text(entry.to) === entity.entityId)) taskIds.add(text(relationship.from));
      for (const task of slice.tasks.filter((entry) => records(entry.subtasks).some((subtask) => text(subtask.cardId) === entity.entityId))) taskIds.add(text(task.cardId));
      continue;
    }
    if (entity.entityType === 'relationship') {
      const current = relationships.find((entry) => text(entry.id) === entity.entityId && text(entry.label) === 'subtask');
      if (current) taskIds.add(text(current.from));
      for (const task of slice.tasks.filter((entry) => records(entry.subtasks).some((subtask) => text(subtask.relationshipId) === entity.entityId))) taskIds.add(text(task.cardId));
      continue;
    }
    return null;
  }
  return taskIds;
}

function rebuildAffectedTasks(input: { slice: ProjectSlice; project: DecisionOsProject; taskProjection: AnyRecord; taskIds: string[]; onTaskMaterialized?: () => void }): ProjectSlice {
  const ledger = input.taskProjection?.ledger && typeof input.taskProjection.ledger === 'object' && !Array.isArray(input.taskProjection.ledger)
    ? input.taskProjection.ledger as AnyRecord
    : input.taskProjection;
  if (!ledger) throw new Error(`Task projection unavailable for project ${input.project.id}.`);
  if (input.taskIds.length === 0) return input.slice;
  const ledgerEntry = input.project.ledgers.find((entry) => entry.id === 'tasks') ?? { id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' };
  const cards = records(ledger.cards);
  const nextTasks = [...input.slice.tasks];
  for (const taskId of input.taskIds) {
    const existingIndex = nextTasks.findIndex((task) => text(task.cardId) === taskId);
    const card = cards.find((entry) => text(entry.id) === taskId);
    const task = card ? taskFrom({ project: input.project, ledgerEntry, ledger, card, conflicts: records(input.taskProjection?.conflicts) }) : null;
    input.onTaskMaterialized?.();
    if (task && existingIndex >= 0) nextTasks[existingIndex] = task;
    else if (task) nextTasks.push(task);
    else if (existingIndex >= 0) nextTasks.splice(existingIndex, 1);
  }
  const next = { ...input.slice, tasks: nextTasks };
  return { ...next, fingerprint: sliceFingerprint(next) };
}

function aggregateProjection(input: { slices: ProjectSlice[]; revision: number; stale?: boolean; error?: string }): Projection {
  const tasks = input.slices.flatMap((slice) => slice.tasks);
  const dependencies = input.slices.flatMap((slice) => slice.dependencies);
  const fingerprint = createHash('sha256').update(JSON.stringify({ schemaVersion, projectorVersion, slices: input.slices.map((slice) => [slice.projectId, slice.fingerprint]) })).digest('hex');
  return {
    schemaVersion, projectorVersion, revision: input.revision, generatedAt: new Date().toISOString(), fingerprint, stale: input.stale === true,
    queue: tasks.filter((task) => task.status === 'task-waiting').sort(compareControlRoomQueueTasks),
    exec: tasks.filter((task) => task.status === 'task-execution').sort(compareTasks),
    backlog: tasks.filter((task) => task.status === 'task-backlog').sort(compareTasks),
    done: tasks.filter((task) => task.status === 'task-complete').sort(compareTasks),
    allTasks: tasks,
    ledgers: Array.from(new Set(tasks.map((task) => text(task.ledger)))).sort(),
    diagnostics: [...tasks.filter((task) => task.valid === false), ...(input.error ? [{ valid: false, message: input.error }] : [])],
    projects: input.slices.map((slice) => slice.project),
    dependencies,
    projectSlices: input.slices,
  };
}

export function createControlRoomProjectionStore(input: { cacheFile: string; taskProjectionForProject: (project: DecisionOsProject) => AnyRecord }): {
  get(projects: DecisionOsProject[]): Projection;
  invalidate(projectId?: string, entities?: ProjectionEntityChange[]): void;
  reconcile(projects: DecisionOsProject[]): boolean;
  diagnostics(): { projectBuilds: number; taskMaterializations: number; largestIncrementalBatch: number };
} {
  let current: Projection | null = null;
  const slices = new Map<string, ProjectSlice>();
  const dirtyProjects = new Set<string>();
  const dirtyEntities = new Map<string, Map<string, ProjectionEntityChange>>();
  const dirtyTaskIds = new Map<string, Set<string>>();
  let dirtyAll = true;
  let revision = 0;
  let lastReconcileAt = 0;
  let latestProjects: DecisionOsProject[] = [];
  let rebuildScheduled = false;
  let projectBuilds = 0;
  let taskMaterializations = 0;
  let largestIncrementalBatch = 0;
  try {
    const persisted = JSON.parse(readFileSync(input.cacheFile, 'utf8')) as Projection;
    if (persisted.schemaVersion === schemaVersion && persisted.projectorVersion === projectorVersion) {
      const persistedSlices = records(persisted.projectSlices) as unknown as ProjectSlice[];
      const valid = persistedSlices.length > 0 && persistedSlices.every((slice) => slice.dependencies.every((entry) => (
        entry.size < 0 ? !existsSync(entry.path) : dependency(entry.path)?.sha256 === entry.sha256
      )));
      if (valid) {
        for (const slice of persistedSlices) slices.set(slice.projectId, slice);
        current = persisted;
        revision = persisted.revision;
        dirtyAll = false;
      }
    }
  } catch {
    current = null;
  }
  const persist = (next: Projection): void => {
    mkdirSync(dirname(input.cacheFile), { recursive: true });
    const temporary = `${input.cacheFile}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(temporary, `${JSON.stringify(next)}\n`);
    renameSync(temporary, input.cacheFile);
  };
  const publish = (projects: DecisionOsProject[]): Projection => {
    const incrementalPublish = !dirtyAll && [...dirtyProjects].every((projectId) => dirtyEntities.has(projectId) || dirtyTaskIds.has(projectId));
    const projectIds = new Set(projects.map((project) => project.id));
    for (const projectId of slices.keys()) if (!projectIds.has(projectId)) slices.delete(projectId);
    const remainingDirtyProjects = new Set<string>();
    for (const project of projects) {
      if (!dirtyAll && !dirtyProjects.has(project.id) && slices.has(project.id)) continue;
      const taskProjection = input.taskProjectionForProject(project);
      const entities = dirtyEntities.get(project.id);
      const currentSlice = slices.get(project.id);
      projectBuilds += 1;
      let taskIds = dirtyTaskIds.get(project.id);
      if (!dirtyAll && currentSlice && entities && !taskIds) {
        const ledger = taskProjection?.ledger && typeof taskProjection.ledger === 'object' && !Array.isArray(taskProjection.ledger)
          ? taskProjection.ledger as AnyRecord
          : taskProjection;
        const affected = ledger ? affectedTaskIds(currentSlice, ledger, [...entities.values()]) : null;
        if (affected) taskIds = affected;
      }
      if (!dirtyAll && currentSlice && taskIds) {
        const batch = [...taskIds].sort().slice(0, taskMaterializationBatchSize);
        largestIncrementalBatch = Math.max(largestIncrementalBatch, batch.length);
        slices.set(project.id, rebuildAffectedTasks({ slice: currentSlice, project, taskProjection, taskIds: batch, onTaskMaterialized: () => { taskMaterializations += 1; } }));
        for (const taskId of batch) taskIds.delete(taskId);
        if (taskIds.size > 0) {
          dirtyTaskIds.set(project.id, taskIds);
          remainingDirtyProjects.add(project.id);
        } else dirtyTaskIds.delete(project.id);
      } else {
        slices.set(project.id, buildProjectSlice({ project, taskProjection, onTaskMaterialized: () => { taskMaterializations += 1; } }));
        dirtyTaskIds.delete(project.id);
      }
    }
    const orderedSlices = projects.map((project) => slices.get(project.id)).filter((slice): slice is ProjectSlice => Boolean(slice));
    const next = aggregateProjection({ slices: orderedSlices, revision: revision + 1 });
    // WHAT: Invalidate the disk snapshot instead of serializing every task after a scoped entity change.
    // WHY: Normal mutations must not stringify and rewrite the complete Control Room workspace cache.
    if (incrementalPublish) rmSync(input.cacheFile, { force: true });
    else persist(next);
    current = next;
    revision = next.revision;
    dirtyAll = false;
    dirtyProjects.clear();
    for (const projectId of remainingDirtyProjects) dirtyProjects.add(projectId);
    dirtyEntities.clear();
    lastReconcileAt = Date.now();
    if (dirtyProjects.size > 0) schedulePublish();
    return next;
  };
  const schedulePublish = (): void => {
    if (rebuildScheduled || latestProjects.length === 0) return;
    rebuildScheduled = true;
    setImmediate(() => {
      rebuildScheduled = false;
      try {
        publish(latestProjects);
      } catch (cause) {
        if (!current) return;
        current = aggregateProjection({
          slices: latestProjects.map((project) => slices.get(project.id)).filter((slice): slice is ProjectSlice => Boolean(slice)),
          revision,
          stale: true,
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    });
  };
  return {
    get(projects) {
      latestProjects = projects;
      if (Date.now() - lastReconcileAt >= 30_000) this.reconcile(projects);
      if (!dirtyAll && dirtyProjects.size === 0 && current) return current;
      // WHAT: Build synchronously only when no usable projection exists yet.
      // WHY: Normal Control Room reads must return the watcher-maintained snapshot without scanning project files.
      if (current) {
        schedulePublish();
        return current;
      }
      try {
        return publish(projects);
      } catch (cause) {
        if (!current) throw cause;
        return aggregateProjection({ slices: projects.map((project) => slices.get(project.id)).filter((slice): slice is ProjectSlice => Boolean(slice)), revision, stale: true, error: cause instanceof Error ? cause.message : String(cause) });
      }
    },
    invalidate(projectId, entities) {
      if (projectId) {
        if (entities) {
          if (entities.length === 0) return;
          if (entities.every((entity) => entity.entityType === 'resource' || entity.entityType === 'thread-note')) return;
          const pending = dirtyEntities.get(projectId) ?? new Map<string, ProjectionEntityChange>();
          for (const entity of entities) pending.set(`${entity.entityType}\u0000${entity.entityId}`, entity);
          dirtyEntities.set(projectId, pending);
        } else {
          dirtyEntities.delete(projectId);
          dirtyTaskIds.delete(projectId);
        }
        dirtyProjects.add(projectId);
      } else {
        dirtyAll = true;
        dirtyEntities.clear();
        dirtyTaskIds.clear();
      }
      schedulePublish();
    },
    reconcile(projects) {
      latestProjects = projects;
      if (!current) { dirtyAll = true; lastReconcileAt = Date.now(); return true; }
      let changed = false;
      for (const slice of slices.values()) {
        if (slice.dependencies.some((entry) => {
          if (entry.size < 0) return existsSync(entry.path);
          if (!existsSync(entry.path)) return true;
          const next = statSync(entry.path);
          return next.size !== entry.size || next.mtimeMs !== entry.mtimeMs;
        })) {
          dirtyProjects.add(slice.projectId);
          changed = true;
        }
      }
      const projectIds = new Set(projects.map((project) => project.id));
      const cachedProjectIds = new Set(slices.keys());
      const catalogChanged = projectIds.size !== cachedProjectIds.size || [...projectIds].some((id) => !cachedProjectIds.has(id));
      if (catalogChanged) dirtyAll = true;
      lastReconcileAt = Date.now();
      if (changed || catalogChanged) schedulePublish();
      return changed || catalogChanged;
    },
    diagnostics: () => ({ projectBuilds, taskMaterializations, largestIncrementalBatch }),
  };
}
