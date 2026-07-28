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
import type { ReplicatedTaskExecutionRecord, TaskExecutionRepository } from '../../task-state/helper/task-execution-repository.js';
import {
  addRelationshipToIndex,
  cachedAggregateTasks,
  createAggregateTaskIndex,
  indexTaskLedger,
  removeRelationshipFromIndex,
  taskKey,
  type AggregateTaskIndex,
  type TaskLedgerIndex,
} from './control-room-projection-index.js';

type AnyRecord = Record<string, unknown>;
type Dependency = { path: string; size: number; mtimeMs: number; sha256: string };
type Projection = AnyRecord & { schemaVersion: number; projectorVersion: string; revision: number; generatedAt: string; fingerprint: string };
type ProjectSlice = { projectId: string; project: AnyRecord; tasks: AnyRecord[]; dependencies: Dependency[]; fingerprint: string; taskRoot: string };
type ProjectionEntityChange = { entityType: string; entityId: string };
type ExecutionCandidate = { card: AnyRecord; intent: AnyRecord; state: string; ownerCardId: string; ownerKind: 'master-task' | 'subtask'; record?: ReplicatedTaskExecutionRecord };

const schemaVersion = 9;
const projectorVersion = 'control-room-v18-replicated-execution';
const taskMaterializationBatchSize = 64;
const terminalPhases = new Set(['succeeded', 'failed', 'cancelled', 'interrupted']);

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function executionPhase(intent: AnyRecord): string {
  return text(intent.phase);
}

function activeExecutionPhase(phase: string): boolean {
  return ['preparing', 'queued', 'starting', 'running'].includes(phase);
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

function selectedExecutionCandidate(master: AnyRecord, subtasks: AnyRecord[], executions: ReplicatedTaskExecutionRecord[]): ExecutionCandidate | null {
  const cards = new Map([master, ...subtasks].map((card) => [text(card.id), card]));
  const replicated = executions.filter((record) => record.metadata.taskId === text(master.id) && activeExecutionPhase(record.lifecycle.phase)).map((record): ExecutionCandidate => ({
    card: cards.get(record.metadata.ownerCardId) ?? master,
    intent: { executionId: record.metadata.executionId, ...record.lifecycle },
    state: record.lifecycle.phase,
    ownerCardId: record.metadata.ownerCardId,
    ownerKind: record.metadata.ownerCardId === text(master.id) ? 'master-task' : 'subtask',
    record,
  }));
  const candidates = replicated;
  const priority = (candidate: ExecutionCandidate): number => candidate.state === 'running' ? 0 : candidate.state === 'starting' ? 1 : candidate.state === 'queued' ? 2 : 3;
  return candidates.sort((left, right) => priority(left) - priority(right)
    || Number(left.ownerKind === 'subtask') - Number(right.ownerKind === 'subtask')
    || text(left.ownerCardId).localeCompare(text(right.ownerCardId))
    || text(left.record?.metadata.executionId).localeCompare(text(right.record?.metadata.executionId)))[0] ?? null;
}

function taskFrom(input: { project: DecisionOsProject; ledgerEntry: DecisionOsProject['ledgers'][number]; ledger: AnyRecord; card: AnyRecord; conflicts?: AnyRecord[]; index?: TaskLedgerIndex; runtime?: AnyRecord; executions?: ReplicatedTaskExecutionRecord[]; executionDiagnostics?: ReturnType<TaskExecutionRepository['diagnostics']>; executionObservationFor?: (executionId: string) => AnyRecord | null }): AnyRecord | null {
  const jsonLabels = Array.isArray(input.card.labels) ? input.card.labels.map(String) : [];
  if (!jsonLabels.includes('master-task')) return null;
  const lifecycle = input.card.lifecycle && typeof input.card.lifecycle === 'object' && !Array.isArray(input.card.lifecycle) ? input.card.lifecycle as AnyRecord : {};
  const assignment = input.card.assignment && typeof input.card.assignment === 'object' && !Array.isArray(input.card.assignment) ? input.card.assignment as AnyRecord : {};
  const cards = input.index?.cards ?? new Map(records(input.ledger.cards).map((card) => [text(card.id), card]));
  const relationships = input.index?.relationshipsByMaster.get(text(input.card.id)) ?? records(input.ledger.relationships)
    .filter((relationship) => text(relationship.from) === text(input.card.id) && text(relationship.label) === 'subtask')
    .sort((left, right) => Number(left.position) - Number(right.position) || text(left.id).localeCompare(text(right.id)));
  const linkedCards = relationships.map((relationship) => cards.get(text(relationship.to))).filter((card): card is AnyRecord => Boolean(card));
  const execution = selectedExecutionCandidate(input.card, linkedCards, input.executions ?? []);
  const executionLifecycle = execution?.intent ?? {};
  const lifecycleStatus = text(lifecycle.status);
  const executionState = executionPhase(executionLifecycle);
  const executionActive = activeExecutionPhase(executionState);
  const waitingSince = text(lifecycle.waitingAt);
  const completedAt = text(lifecycle.closedAt);
  const waitingTime = Date.parse(waitingSince);
  const completedTime = Date.parse(completedAt);
  const status = executionActive ? 'task-execution' : lifecycleStatus === 'backlog' ? 'task-backlog' : lifecycleStatus === 'done' ? 'task-complete' : 'task-waiting';
  const labels = [...new Set(jsonLabels.map((label) => label.trim()).filter((label) => label && label !== 'master-task' && label !== 'subtask'))];
  const subtasks: AnyRecord[] = [];
  for (const relationship of relationships) {
    const cardId = text(relationship.to);
    const linked = cards.get(cardId);
    const childLifecycle = linked?.lifecycle && typeof linked.lifecycle === 'object' && !Array.isArray(linked.lifecycle) ? linked.lifecycle as AnyRecord : {};
    subtasks.push({ title: text(linked?.title) || `Card ${cardId}`, cardId, relationshipId: text(relationship.id), position: Number(relationship.position), status: childLifecycle.status === 'done' ? 'complete' : 'waiting', zoneId: linked ? zoneIdFor(linked, input.ledger) : 'ungrouped' });
  }
  const diagnostics: string[] = [];
  if (!['todo', 'backlog', 'done'].includes(lifecycleStatus)) diagnostics.push('invalid_lifecycle');
  for (const relationship of relationships) {
    if (!Number.isInteger(Number(relationship.position)) || Number(relationship.position) < 0) diagnostics.push(`invalid_subtask_position:${text(relationship.id)}`);
    if (!cards.has(text(relationship.to))) diagnostics.push(`missing_subtask:${text(relationship.to)}`);
  }
  const taskIds = new Set([text(input.card.id), ...relationships.map((relationship) => text(relationship.to))]);
  const taskConflicts = records(input.conflicts).filter((conflict) => conflict.kind === 'task-conflict' && conflict.path === 'lifecycle' && taskIds.has(text(conflict.entityId)));
  const assignmentConflicts = records(input.conflicts).filter((conflict) => conflict.kind === 'assignment-conflict' && conflict.path === 'assignment' && text(conflict.entityId) === text(input.card.id));
  if (taskConflicts.length > 0) diagnostics.push(...taskConflicts.map((conflict) => `task-conflict:${text(conflict.entityId)}`));
  if (assignmentConflicts.length > 0) diagnostics.push(`assignment-conflict:${text(input.card.id)}`);
  if (!text(assignment.nodeId)) diagnostics.push('missing_assignment');
  for (const executionDiagnostic of input.executionDiagnostics ?? []) {
    if (executionDiagnostic.taskId === text(input.card.id)) diagnostics.push(`${executionDiagnostic.code}:${executionDiagnostic.executionId}`);
  }
  const complete = subtasks.filter((subtask) => subtask.status === 'complete').length;
  const executionSince = executionActive ? text(executionLifecycle.phaseSince) || text(executionLifecycle.startedAt) || text(executionLifecycle.changedAt) : '';
  const executionId = text(executionLifecycle.executionId) || text(executionLifecycle.id);
  const replicatedExecution = execution?.record ? {
    ...execution.record.metadata,
    ...execution.record.lifecycle,
    artifacts: execution.record.artifacts,
    live: false,
    observation: null,
    validActions: terminalPhases.has(execution.record.lifecycle.phase)
      ? ['restart', 'open-log']
      : execution.record.lifecycle.phase === 'cancelling'
        ? ['open-log']
        : ['cancel', 'open-log'],
  } : null;
  const canonicalExecution = replicatedExecution;
  const projectedObservation = executionId ? input.executionObservationFor?.(executionId) ?? null : null;
  const observation = canonicalExecution?.observation?.executionId === executionId ? canonicalExecution.observation : projectedObservation;
  return {
    valid: diagnostics.length === 0, masterTask: true, diagnostics,
    cardId: text(input.card.id), title: text(input.card.title) || `Card ${text(input.card.id)}`, labels,
    cardStatus: lifecycleStatus, createdAt: text(input.card.createdAt), lifecycle: structuredClone(lifecycle), assignment: structuredClone(assignment), taskConflict: taskConflicts.length > 0, assignmentConflict: assignmentConflicts.length > 0,
    projectId: input.project.id, projectName: input.project.name, projectColor: input.project.color,
    ledgerId: input.ledgerEntry.id, ledgerTitle: input.ledgerEntry.title, ledger: input.ledgerEntry.title,
    zoneId: zoneIdFor(input.card, input.ledger), status,
    codexRunId: executionActive ? canonicalExecution?.sessionId ?? '' : '', codexPipelineRunId: executionActive ? canonicalExecution?.pipelineRunId ?? '' : '', codexStatus: executionState,
    executionOwnerCardId: executionActive ? text(execution?.ownerCardId) : '', executionOwnerKind: executionActive ? text(execution?.ownerKind) : '',
    executionStatus: executionActive ? executionState : '', execution: canonicalExecution, executionObservation: observation,
    transcribingBeforeLaunch: executionState === 'preparing' && canonicalExecution?.kind === 'voice',
    codexProcessing: executionState === 'starting' || executionState === 'running' || executionState === 'cancelling', codexQueued: executionState === 'queued', codexQueuePosition: null,
    executionNodeId: observation?.executorNodeId ?? execution?.record?.lifecycle.executorNodeId ?? '', executionNodeLabel: '',
    assignedNodeId: text(assignment.nodeId), assignedNodeLabel: '', assignedNodeOnline: null,
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
export function controlRoomProjectionFromTaskLedger(input: { project: DecisionOsProject; ledger: AnyRecord; conflicts?: AnyRecord[]; runtime?: AnyRecord; executions?: ReplicatedTaskExecutionRecord[]; executionDiagnostics?: ReturnType<TaskExecutionRepository['diagnostics']>; executionObservationFor?: (executionId: string) => AnyRecord | null }): AnyRecord {
  const ledgerEntry = input.project.ledgers.find((entry) => entry.id === 'tasks') ?? { id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' };
  const index = indexTaskLedger(input.ledger);
  const tasks = records(input.ledger.cards).flatMap((card) => {
    const task = taskFrom({ project: input.project, ledgerEntry, ledger: input.ledger, card, conflicts: input.conflicts, index, runtime: input.runtime, executions: input.executions, executionDiagnostics: input.executionDiagnostics, executionObservationFor: input.executionObservationFor });
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

function sliceFingerprint(slice: Pick<ProjectSlice, 'projectId' | 'project' | 'dependencies' | 'tasks' | 'taskRoot'>): string {
  return createHash('sha256').update(JSON.stringify({
    projectId: slice.projectId,
    originFingerprint: text(slice.project.originFingerprint),
    schemaVersion,
    projectorVersion,
    dependencies: slice.dependencies.map(({ path, sha256 }) => ({ path, sha256 })),
    taskState: slice.taskRoot || slice.tasks,
    executions: slice.tasks.map((task) => [task.cardId, task.execution, task.executionObservation]),
  })).digest('hex');
}

function buildProjectSlice(input: { project: DecisionOsProject; taskProjection: AnyRecord; taskRoot?: string; runtime?: AnyRecord; executions?: ReplicatedTaskExecutionRecord[]; executionDiagnostics?: ReturnType<TaskExecutionRepository['diagnostics']>; onTaskMaterialized?: () => void }): { slice: ProjectSlice; index: TaskLedgerIndex } {
  const tasks: AnyRecord[] = [];
  const dependencies: Dependency[] = [];
  const project = input.project;
  for (const metadataFile of [resolve(project.decisionOsRoot, 'state.json'), resolve(project.decisionOsRoot, 'project.json')]) {
    const metadataDependency = dependency(metadataFile);
    if (metadataDependency) dependencies.push(metadataDependency);
  }
  let index: TaskLedgerIndex = indexTaskLedger({});
  for (const ledgerEntry of project.ledgers.filter((entry) => entry.id === 'tasks')) {
      const projectedLedger = input.taskProjection?.ledger && typeof input.taskProjection.ledger === 'object' && !Array.isArray(input.taskProjection.ledger)
        ? input.taskProjection.ledger as AnyRecord
        : input.taskProjection;
      if (!projectedLedger) throw new Error(`Task projection unavailable for project ${project.id}.`);
      const ledger = structuredClone(projectedLedger);
      index = indexTaskLedger(ledger);
      for (const card of records(ledger.cards)) {
        const task = taskFrom({ project, ledgerEntry, ledger, card, conflicts: records(input.taskProjection?.conflicts), index, runtime: input.runtime, executions: input.executions, executionDiagnostics: input.executionDiagnostics });
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
    taskRoot: input.taskRoot ?? '',
  };
  return { slice: { ...slice, fingerprint: sliceFingerprint(slice) }, index };
}

function affectedTaskIds(index: TaskLedgerIndex, entities: ProjectionEntityChange[], entityFor: (entityType: 'card' | 'relationship', entityId: string) => AnyRecord | null, executionFor?: (executionId: string) => ReplicatedTaskExecutionRecord | null): Set<string> | null {
  const taskIds = new Set<string>();
  for (const entity of entities) {
    // WHAT: Content entities never participate in the structural Control Room projection.
    // WHY: Body and thread delivery must not trigger task materialization.
    if (entity.entityType === 'resource' || entity.entityType === 'thread-note') continue;
    if (entity.entityType === 'card') {
      taskIds.add(entity.entityId);
      for (const masterId of index.mastersByChild.get(entity.entityId) ?? []) taskIds.add(masterId);
      const current = entityFor('card', entity.entityId);
      if (current) index.cards.set(entity.entityId, current);
      else index.cards.delete(entity.entityId);
      continue;
    }
    if (entity.entityType === 'relationship') {
      const previous = index.relationships.get(entity.entityId);
      if (previous) {
        taskIds.add(text(previous.from));
        removeRelationshipFromIndex(index, previous);
      }
      const current = entityFor('relationship', entity.entityId);
      if (current) {
        index.relationships.set(entity.entityId, current);
        addRelationshipToIndex(index, current);
        taskIds.add(text(current.from));
      } else index.relationships.delete(entity.entityId);
      continue;
    }
    if (entity.entityType === 'execution') {
      const execution = executionFor?.(entity.entityId);
      if (!execution) return null;
      if (execution.metadata.taskId) taskIds.add(execution.metadata.taskId);
      continue;
    }
    return null;
  }
  return taskIds;
}

function rebuildAffectedTasks(input: { slice: ProjectSlice; index: TaskLedgerIndex; taskPositions: Map<string, number>; project: DecisionOsProject; taskProjection: AnyRecord; taskRoot?: string; taskIds: string[]; runtime?: AnyRecord; executions?: ReplicatedTaskExecutionRecord[]; executionDiagnostics?: ReturnType<TaskExecutionRepository['diagnostics']>; onTaskMaterialized?: () => void }): ProjectSlice {
  const ledger = input.taskProjection?.ledger && typeof input.taskProjection.ledger === 'object' && !Array.isArray(input.taskProjection.ledger)
    ? input.taskProjection.ledger as AnyRecord
    : input.taskProjection;
  if (!ledger) throw new Error(`Task projection unavailable for project ${input.project.id}.`);
  if (input.taskIds.length === 0) return input.slice;
  const ledgerEntry = input.project.ledgers.find((entry) => entry.id === 'tasks') ?? { id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' };
  const nextTasks = [...input.slice.tasks];
  for (const taskId of input.taskIds) {
    const existingIndex = input.taskPositions.get(taskId) ?? -1;
    const card = input.index.cards.get(taskId);
    const task = card ? taskFrom({ project: input.project, ledgerEntry, ledger, card, conflicts: records(input.taskProjection?.conflicts), index: input.index, runtime: input.runtime, executions: input.executions, executionDiagnostics: input.executionDiagnostics }) : null;
    input.onTaskMaterialized?.();
    if (task && existingIndex >= 0) nextTasks[existingIndex] = task;
    else if (task) {
      input.taskPositions.set(taskId, nextTasks.length);
      nextTasks.push(task);
    } else if (existingIndex >= 0) {
      nextTasks.splice(existingIndex, 1);
      input.taskPositions.delete(taskId);
      for (let index = existingIndex; index < nextTasks.length; index += 1) input.taskPositions.set(text(nextTasks[index].cardId), index);
    }
  }
  const next = { ...input.slice, tasks: nextTasks, taskRoot: input.taskRoot ?? '' };
  return { ...next, fingerprint: sliceFingerprint(next) };
}

function aggregateProjection(input: { slices: ProjectSlice[]; revision: number; taskIndex?: AggregateTaskIndex; stale?: boolean; error?: string }): Projection {
  const taskIndex = input.taskIndex ?? createAggregateTaskIndex(input.slices.flatMap((slice) => slice.tasks));
  const dependencies = input.slices.flatMap((slice) => slice.dependencies);
  const fingerprint = createHash('sha256').update(JSON.stringify({ schemaVersion, projectorVersion, slices: input.slices.map((slice) => [slice.projectId, slice.fingerprint]) })).digest('hex');
  const projection = {
    schemaVersion, projectorVersion, revision: input.revision, generatedAt: new Date().toISOString(), fingerprint, stale: input.stale === true,
    projects: input.slices.map((slice) => slice.project),
    dependencies,
    projectSlices: input.slices,
  } as Projection;
  const columns: Array<[string, ((task: AnyRecord) => boolean) | undefined, ((left: AnyRecord, right: AnyRecord) => number) | undefined]> = [
    ['queue', (task) => task.status === 'task-waiting', compareControlRoomQueueTasks],
    ['exec', (task) => task.status === 'task-execution', compareTasks],
    ['backlog', (task) => task.status === 'task-backlog', compareTasks],
    ['done', (task) => task.status === 'task-complete', compareTasks],
    ['allTasks', undefined, undefined],
    ['diagnostics', (task) => task.valid === false, undefined],
  ];
  for (const [name, predicate, compare] of columns) Object.defineProperty(projection, name, {
    enumerable: true,
    get: () => {
      const tasks = cachedAggregateTasks(taskIndex, name, predicate, compare);
      return name === 'diagnostics' && input.error ? [...tasks, { valid: false, message: input.error }] : tasks;
    },
  });
  Object.defineProperty(projection, 'ledgers', {
    enumerable: true,
    get: () => Array.from(new Set(cachedAggregateTasks(taskIndex, 'allTasks').map((task) => text(task.ledger)))).sort(),
  });
  return projection;
}

export function createControlRoomProjectionStore(input: {
  cacheFile: string;
  taskProjectionForProject: (project: DecisionOsProject) => AnyRecord;
  runtimeForProject?: (project: DecisionOsProject) => AnyRecord | undefined;
  taskExecutionsForProject?: (project: DecisionOsProject) => ReplicatedTaskExecutionRecord[];
  taskExecutionDiagnosticsForProject?: (project: DecisionOsProject) => ReturnType<TaskExecutionRepository['diagnostics']>;
  taskExecutionForProject?: (project: DecisionOsProject, executionId: string) => ReplicatedTaskExecutionRecord | null;
  taskEntityForProject?: (project: DecisionOsProject, entityType: 'card' | 'relationship', entityId: string) => AnyRecord | null;
  taskRootForProject?: (project: DecisionOsProject) => string;
}): {
  get(projects: DecisionOsProject[]): Projection;
  invalidate(projectId?: string, entities?: ProjectionEntityChange[]): void;
  reconcile(projects: DecisionOsProject[]): boolean;
  diagnostics(): { projectBuilds: number; taskMaterializations: number; largestIncrementalBatch: number };
} {
  let current: Projection | null = null;
  const slices = new Map<string, ProjectSlice>();
  const ledgerIndexes = new Map<string, TaskLedgerIndex>();
  const taskPositions = new Map<string, Map<string, number>>();
  let aggregateTaskIndex: AggregateTaskIndex | null = null;
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
        for (const slice of persistedSlices) {
          slice.taskRoot ??= '';
          slices.set(slice.projectId, slice);
          taskPositions.set(slice.projectId, new Map(slice.tasks.map((task, index) => [text(task.cardId), index])));
        }
        aggregateTaskIndex = createAggregateTaskIndex(persistedSlices.flatMap((slice) => slice.tasks));
        current = aggregateProjection({ slices: persistedSlices, revision: persisted.revision, taskIndex: aggregateTaskIndex, stale: persisted.stale === true });
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
    let rebuiltWholeProject = false;
    const projectIds = new Set(projects.map((project) => project.id));
    let removedProject = false;
    for (const projectId of slices.keys()) if (!projectIds.has(projectId)) {
      slices.delete(projectId);
      ledgerIndexes.delete(projectId);
      taskPositions.delete(projectId);
      removedProject = true;
    }
    const remainingDirtyProjects = new Set<string>();
    for (const project of projects) {
      if (!dirtyAll && !dirtyProjects.has(project.id) && slices.has(project.id)) continue;
      const taskProjection = input.taskProjectionForProject(project);
      const taskRoot = input.taskRootForProject?.(project) ?? '';
      const projectRuntime = input.runtimeForProject?.(project);
      const executions = input.taskExecutionsForProject?.(project) ?? [];
      const executionDiagnostics = input.taskExecutionDiagnosticsForProject?.(project) ?? [];
      const entities = dirtyEntities.get(project.id);
      const currentSlice = slices.get(project.id);
      projectBuilds += 1;
      let taskIds = dirtyTaskIds.get(project.id);
      if (!dirtyAll && currentSlice && entities && !taskIds) {
        const ledger = taskProjection?.ledger && typeof taskProjection.ledger === 'object' && !Array.isArray(taskProjection.ledger)
          ? taskProjection.ledger as AnyRecord
          : taskProjection;
        let ledgerIndex = ledgerIndexes.get(project.id);
        if (!ledgerIndex && ledger) {
          ledgerIndex = indexTaskLedger(ledger);
          ledgerIndexes.set(project.id, ledgerIndex);
        }
        const affected = ledger && ledgerIndex ? affectedTaskIds(ledgerIndex, [...entities.values()], (entityType, entityId) => (
          input.taskEntityForProject?.(project, entityType, entityId)
          ?? records(entityType === 'card' ? ledger.cards : ledger.relationships).find((entry) => text(entry.id) === entityId)
          ?? null
        ), (executionId) => input.taskExecutionForProject?.(project, executionId) ?? null) : null;
        if (affected) taskIds = affected;
      }
      if (!dirtyAll && currentSlice && taskIds) {
        const batch = [...taskIds].sort().slice(0, taskMaterializationBatchSize);
        largestIncrementalBatch = Math.max(largestIncrementalBatch, batch.length);
        const ledgerIndex = ledgerIndexes.get(project.id)!;
        const positions = taskPositions.get(project.id) ?? new Map(currentSlice.tasks.map((task, index) => [text(task.cardId), index]));
        taskPositions.set(project.id, positions);
        const updatedSlice = rebuildAffectedTasks({ slice: currentSlice, index: ledgerIndex, taskPositions: positions, project, taskProjection, taskRoot, taskIds: batch, runtime: projectRuntime, executions, executionDiagnostics, onTaskMaterialized: () => { taskMaterializations += 1; } });
        slices.set(project.id, updatedSlice);
        if (aggregateTaskIndex) {
          for (const taskId of batch) {
            aggregateTaskIndex.tasks.delete(`${project.id}\u0000${taskId}`);
            const position = positions.get(taskId);
            const task = position === undefined ? null : updatedSlice.tasks[position];
            if (task) aggregateTaskIndex.tasks.set(taskKey(task), task);
          }
          aggregateTaskIndex.generation += 1;
        }
        for (const taskId of batch) taskIds.delete(taskId);
        if (taskIds.size > 0) {
          dirtyTaskIds.set(project.id, taskIds);
          remainingDirtyProjects.add(project.id);
        } else dirtyTaskIds.delete(project.id);
      } else {
        const built = buildProjectSlice({ project, taskProjection, taskRoot, runtime: projectRuntime, executions, executionDiagnostics, onTaskMaterialized: () => { taskMaterializations += 1; } });
        slices.set(project.id, built.slice);
        ledgerIndexes.set(project.id, built.index);
        taskPositions.set(project.id, new Map(built.slice.tasks.map((task, index) => [text(task.cardId), index])));
        dirtyTaskIds.delete(project.id);
        rebuiltWholeProject = true;
      }
    }
    const orderedSlices = projects.map((project) => slices.get(project.id)).filter((slice): slice is ProjectSlice => Boolean(slice));
    if (!incrementalPublish || rebuiltWholeProject || removedProject || !aggregateTaskIndex) aggregateTaskIndex = createAggregateTaskIndex(orderedSlices.flatMap((slice) => slice.tasks));
    const next = aggregateProjection({ slices: orderedSlices, revision: revision + 1, taskIndex: aggregateTaskIndex });
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
  const ensureLedgerIndexes = (projects: DecisionOsProject[]): void => {
    for (const project of projects) {
      if (ledgerIndexes.has(project.id)) continue;
      const taskProjection = input.taskProjectionForProject(project);
      const ledger = taskProjection?.ledger && typeof taskProjection.ledger === 'object' && !Array.isArray(taskProjection.ledger)
        ? taskProjection.ledger as AnyRecord
        : taskProjection;
      if (ledger) ledgerIndexes.set(project.id, indexTaskLedger(ledger));
    }
  };
  return {
    get(projects) {
      latestProjects = projects;
      ensureLedgerIndexes(projects);
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
