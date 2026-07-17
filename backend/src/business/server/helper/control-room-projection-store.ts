/**
 * WHAT: Builds and caches the global, server-owned Control Room read model.
 * WHY: The browser must not download hydrated ledgers and run histories to reconstruct task state.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { readCardDescription } from '../../ledger/helper/card-content-file.js';
import { parseThreadMarkdown, resolveThreadContentFile } from '../../ledger/helper/thread-content-file.js';
import { readCodexPipelineStore } from '../../codex/helper/codex-pipeline-store.js';
import { readCodexProcessQueue } from '../../codex/helper/codex-process-queue.js';
import { latestCodexRunSegmentStartedAtMs, latestCodexRunSegmentStartLine, latestCodexRunTurnStartedAtMs } from '../../codex/helper/codex-run-segment-marker.js';
import { readCardSkillRunEventLines } from '../../codex/helper/read-card-skill-run-event-lines.js';
import type { DecisionOsProject } from './project-catalog.js';
import { compareControlRoomQueueTasks } from './control-room-queue-order.js';

type AnyRecord = Record<string, unknown>;
type Dependency = { path: string; size: number; mtimeMs: number; sha256: string };
type Projection = AnyRecord & { schemaVersion: number; projectorVersion: string; revision: number; generatedAt: string; fingerprint: string };
type ProjectSlice = { projectId: string; project: AnyRecord; tasks: AnyRecord[]; dependencies: Dependency[]; fingerprint: string };

const schemaVersion = 5;
const projectorVersion = 'control-room-v6-execution-status';

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

function watchedDependency(file: string): Dependency {
  return dependency(file) ?? { path: file, size: -1, mtimeMs: -1, sha256: '' };
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

function runtimeStatus(input: { card: AnyRecord; runtime: AnyRecord; pipelineRuns: AnyRecord[]; queuedRuns: AnyRecord[] }): AnyRecord {
  const persistedExecutionStatus = ['pending', 'running'].includes(text(input.card.executionStatus))
    ? text(input.card.executionStatus)
    : '';
  const runId = text(input.card.codexActiveRunId) || text(input.card.codexThreadRunId) || text(input.card.codexRunId);
  const pipelineRunId = text(input.card.codexQueuedPipelineRunId);
  if (pipelineRunId) {
    const run = input.pipelineRuns.find((entry) => text(entry.id) === pipelineRunId);
    const steps = records(run?.steps);
    const activeStep = steps.find((step) => ['pending', 'running'].includes(text(step.status)));
    const activeSkill = records(activeStep?.skills).find((skill) => ['pending', 'running'].includes(text(skill.status)));
    const status = persistedExecutionStatus || text(run?.status) || 'unknown';
    const queueIndex = input.queuedRuns.findIndex((entry) => text(entry.id) === pipelineRunId || text((entry.payload as AnyRecord | undefined)?.runId) === pipelineRunId);
    return { runId, pipelineRunId, status, startedAt: text(run?.resumedAt) || text(run?.createdAt) || text(run?.startedAt) || text(activeSkill?.startedAt) || text(activeStep?.startedAt), queuePosition: status === 'pending' && queueIndex >= 0 ? queueIndex + 1 : null };
  }
  const runtimeRuns = input.runtime.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object' ? input.runtime.codexSkillRuns as Record<string, AnyRecord> : {};
  const live = runtimeRuns[runId] ?? {};
  const queueIndex = input.queuedRuns.findIndex((entry) => text(entry.id) === runId || text((entry.payload as AnyRecord | undefined)?.runId) === runId);
  const status = persistedExecutionStatus || text(live.status) || (queueIndex >= 0 ? 'pending' : 'unknown');
  const stderrFile = text(live.stderrFile);
  const stdoutFile = text(live.stdoutFile);
  const log = stderrFile && existsSync(stderrFile) ? readFileSync(stderrFile, 'utf8') : '';
  const segmentStartedAtMs = log ? latestCodexRunSegmentStartedAtMs({ log, runId }) : 0;
  const observedTurnStartedAtMs = log ? latestCodexRunTurnStartedAtMs({ log, runId }) : 0;
  const segmentStartLine = log ? latestCodexRunSegmentStartLine({ log, runId }) : 0;
  const legacyTurnStarted = observedTurnStartedAtMs === 0 && stdoutFile && existsSync(stdoutFile)
    ? readCardSkillRunEventLines(stdoutFile).some((entry) => entry.line > segmentStartLine && text(entry.event.type) === 'turn.started')
    : false;
  const turnStartedAtMs = observedTurnStartedAtMs || (legacyTurnStarted ? segmentStartedAtMs : 0);
  const turnPending = segmentStartedAtMs > 0 && turnStartedAtMs === 0;
  const startedAt = turnStartedAtMs > 0 ? new Date(turnStartedAtMs).toISOString() : turnPending ? '' : text(live.startedAt);
  return { runId, pipelineRunId: '', status, startedAt, turnPending, queuePosition: status === 'pending' && queueIndex >= 0 ? queueIndex + 1 : null };
}

function taskFrom(input: { project: DecisionOsProject; ledgerEntry: DecisionOsProject['ledgers'][number]; ledger: AnyRecord; card: AnyRecord; runtime: AnyRecord; pipelineRuns: AnyRecord[]; queuedRuns: AnyRecord[] }): AnyRecord | null {
  const markdown = readCardDescription({ decisionOsRoot: input.project.decisionOsRoot, card: input.card }).replace(/\r\n?/g, '\n');
  const jsonLabels = Array.isArray(input.card.labels) ? input.card.labels.map(String) : [];
  const hasJsonTaskLabel = jsonLabels.some((label) => label === 'master-task' || label === 'subtask');
  const labelLines = markdown.split('\n').filter((line) => /^\s*(?:#[a-z][a-z0-9-]*\s*)+$/i.test(line));
  const legacyLabels = new Set(Array.from(labelLines.join('\n').matchAll(/#([a-z][a-z0-9-]*)\b/gi), (match) => match[1].toLowerCase()));
  if (!jsonLabels.includes('master-task') && (hasJsonTaskLabel || !legacyLabels.has('master-task'))) return null;
  const legacyLedgerName = markdown.match(/^\s*(?:\*\*)?Ledger(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const ledgerName = jsonLabels.includes('master-task') ? input.ledgerEntry.title : legacyLedgerName;
  const waitingText = markdown.match(/^\s*(?:\*\*)?Waiting since(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const executionText = markdown.match(/^\s*(?:\*\*)?Active since(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const rankText = markdown.match(/^\s*(?:\*\*)?Queue rank(?:\*\*)?\s*:\s*(\d+)\s*$/im)?.[1] ?? '';
  const threadId = `thread-${text(input.card.id)}`;
  const threadRef = input.ledger.threadFiles && typeof input.ledger.threadFiles === 'object' ? (input.ledger.threadFiles as AnyRecord)[threadId] : '';
  const threadFile = resolveThreadContentFile(input.project.decisionOsRoot, threadRef);
  const notes = threadFile && existsSync(threadFile) ? parseThreadMarkdown(readFileSync(threadFile, 'utf8')) : [];
  const latestThreadTime = notes.reduce((latest, note) => Math.max(latest, Date.parse(text(note.timestamp)) || Number.NEGATIVE_INFINITY), Number.NEGATIVE_INFINITY);
  const waitingTime = Number.isFinite(latestThreadTime) ? latestThreadTime : Date.parse(waitingText);
  const rank = rankText ? Number(rankText) : null;
  const run = runtimeStatus({ card: input.card, runtime: input.runtime, pipelineRuns: input.pipelineRuns, queuedRuns: input.queuedRuns });
  const processing = run.status === 'running' || (!text(input.card.executionStatus) && ['processing', 'in_progress'].includes(text(run.status)));
  const queued = run.status === 'pending';
  const cardStatus = text(input.card.status) || 'todo';
  const status = cardStatus === 'backlog' ? 'task-backlog' : cardStatus === 'done' ? 'task-complete' : processing || queued ? 'task-execution' : 'task-waiting';
  const cards = records(input.ledger.cards);
  const subtasks: AnyRecord[] = [];
  const relationships = records(input.ledger.relationships).filter((relationship) => text(relationship.from) === text(input.card.id) && text(relationship.label) === 'subtask');
  for (const relationship of relationships) {
    const cardId = text(relationship.to);
    const linked = cards.find((card) => text(card.id) === cardId);
    subtasks.push({ title: text(linked?.title) || `Card ${cardId}`, cardId, status: linked?.status === 'done' ? 'complete' : 'waiting', zoneId: linked ? zoneIdFor(linked, input.ledger) : 'ungrouped' });
  }
  const diagnostics: string[] = [];
  if (jsonLabels.includes('master-task') && jsonLabels.includes('subtask')) diagnostics.push('invalid_master_label');
  if (!ledgerName) diagnostics.push('missing Ledger');
  if (!Number.isFinite(waitingTime)) diagnostics.push('invalid Waiting since');
  if (rank !== null && (!Number.isInteger(rank) || rank < 1)) diagnostics.push('invalid Queue rank');
  if (jsonLabels.includes('master-task')) {
    for (const relationship of relationships) {
      const child = cards.find((card) => text(card.id) === text(relationship.to));
      if (!child) diagnostics.push(`missing_subtask:${text(relationship.to)}`);
      else if (!Array.isArray(child.labels) || !child.labels.map(String).includes('subtask') || child.labels.map(String).includes('master-task')) diagnostics.push(`invalid_subtask_label:${text(relationship.to)}`);
    }
  }
  const complete = subtasks.filter((subtask) => subtask.status === 'complete').length;
  const executionSince = processing ? (run.turnPending ? '' : text(run.startedAt) || executionText) : executionText;
  return {
    valid: diagnostics.length === 0, masterTask: true, diagnostics,
    cardId: text(input.card.id), title: text(input.card.title) || `Card ${text(input.card.id)}`,
    projectId: input.project.id, projectName: input.project.name, projectColor: input.project.color,
    ledgerId: input.ledgerEntry.id, ledgerTitle: input.ledgerEntry.title, ledger: ledgerName,
    zoneId: zoneIdFor(input.card, input.ledger), status,
    codexRunId: run.runId, codexPipelineRunId: run.pipelineRunId, codexStatus: run.status,
    executionStatus: processing ? 'running' : queued ? 'pending' : '',
    codexProcessing: processing, codexQueued: queued, codexQueuePosition: queued ? run.queuePosition : null,
    waitingSince: Number.isFinite(latestThreadTime) ? new Date(latestThreadTime).toISOString() : waitingText,
    waitingTime, executionSince,
    executionTime: Date.parse(executionSince), queueRank: rank,
    subtasks, complete, nextSubtask: subtasks.find((subtask) => subtask.status !== 'complete') ?? null,
  };
}

function compareTasks(left: AnyRecord, right: AnyRecord): number {
  if (left.queueRank !== null || right.queueRank !== null) {
    if (left.queueRank === null) return 1;
    if (right.queueRank === null) return -1;
    if (left.queueRank !== right.queueRank) return Number(left.queueRank) - Number(right.queueRank);
  }
  return (Number.isFinite(left.waitingTime) ? Number(left.waitingTime) : Number.POSITIVE_INFINITY)
    - (Number.isFinite(right.waitingTime) ? Number(right.waitingTime) : Number.POSITIVE_INFINITY)
    || text(left.cardId).localeCompare(text(right.cardId));
}

function buildProjectSlice(input: { project: DecisionOsProject; runtime: AnyRecord }): ProjectSlice {
  const tasks: AnyRecord[] = [];
  const dependencies: Dependency[] = [];
  const project = input.project;
  for (const metadataFile of [resolve(project.decisionOsRoot, 'state.json'), resolve(project.decisionOsRoot, 'project.json')]) {
    const metadataDependency = dependency(metadataFile);
    if (metadataDependency) dependencies.push(metadataDependency);
  }
  const pipelineRuns = readCodexPipelineStore({ decisionOsRoot: project.decisionOsRoot }).store.runs as unknown as AnyRecord[];
  const queuedRuns = (readCodexProcessQueue(project.decisionOsRoot) as unknown as AnyRecord[])
    .filter((run) => run.status === 'pending');
  dependencies.push(watchedDependency(resolve(project.decisionOsRoot, 'codex-pipelines.json')));
  dependencies.push(watchedDependency(resolve(project.decisionOsRoot, 'codex-process-queue.json')));
  for (const ledgerEntry of project.ledgers) {
      const ledgerPath = resolve(project.decisionOsRoot, ledgerEntry.ledgerFile.replace(/^\.decision-os\//, ''));
      const ledgerDependency = dependency(ledgerPath);
      if (ledgerDependency) dependencies.push(ledgerDependency);
      if (!existsSync(ledgerPath)) continue;
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord;
      for (const card of records(ledger.cards)) {
        const task = taskFrom({ project, ledgerEntry, ledger, card, runtime: input.runtime, pipelineRuns, queuedRuns });
        if (task) tasks.push(task);
      }
      for (const card of records(ledger.cards)) {
        const contentFile = resolve(project.decisionOsRoot, text((card.comment as AnyRecord | undefined)?.contentFile).replace(/^\.decision-os\//, ''));
        const cardDependency = dependency(contentFile);
        if (cardDependency) dependencies.push(cardDependency);
      }
      const taskCardIds = new Set(tasks
        .filter((task) => task.projectId === project.id && task.ledgerId === ledgerEntry.id)
        .map((task) => text(task.cardId)));
      for (const [threadId, ref] of Object.entries(ledger.threadFiles && typeof ledger.threadFiles === 'object' ? ledger.threadFiles as AnyRecord : {})) {
        if (!taskCardIds.has(threadId.replace(/^thread-/, ''))) continue;
        const threadFile = resolveThreadContentFile(project.decisionOsRoot, ref);
        const threadDependency = threadFile ? dependency(threadFile) : null;
        if (threadDependency) dependencies.push(threadDependency);
      }
  }
  dependencies.sort((left, right) => left.path.localeCompare(right.path));
  const fingerprint = createHash('sha256').update(JSON.stringify({ projectId: project.id, schemaVersion, projectorVersion, dependencies: dependencies.map(({ path, sha256 }) => ({ path, sha256 })) })).digest('hex');
  return { projectId: project.id, project: { id: project.id, name: project.name, color: project.color }, tasks, dependencies, fingerprint };
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

export function createControlRoomProjectionStore(input: { cacheFile: string; runtimeForRoot: (root: string) => AnyRecord }): {
  get(projects: DecisionOsProject[]): Projection;
  invalidate(projectId?: string): void;
  reconcile(projects: DecisionOsProject[]): boolean;
} {
  let current: Projection | null = null;
  const slices = new Map<string, ProjectSlice>();
  const dirtyProjects = new Set<string>();
  let dirtyAll = true;
  let revision = 0;
  let lastReconcileAt = 0;
  let latestProjects: DecisionOsProject[] = [];
  let rebuildScheduled = false;
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
    const projectIds = new Set(projects.map((project) => project.id));
    for (const projectId of slices.keys()) if (!projectIds.has(projectId)) slices.delete(projectId);
    for (const project of projects) {
      if (!dirtyAll && !dirtyProjects.has(project.id) && slices.has(project.id)) continue;
      slices.set(project.id, buildProjectSlice({ project, runtime: input.runtimeForRoot(project.decisionOsRoot) }));
    }
    const orderedSlices = projects.map((project) => slices.get(project.id)).filter((slice): slice is ProjectSlice => Boolean(slice));
    const next = aggregateProjection({ slices: orderedSlices, revision: revision + 1 });
    persist(next);
    current = next;
    revision = next.revision;
    dirtyAll = false;
    dirtyProjects.clear();
    lastReconcileAt = Date.now();
    return next;
  };
  const schedulePublish = (): void => {
    if (rebuildScheduled || latestProjects.length === 0) return;
    rebuildScheduled = true;
    queueMicrotask(() => {
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
    invalidate(projectId) {
      if (projectId) dirtyProjects.add(projectId);
      else dirtyAll = true;
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
  };
}
