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
import type { DecisionOsProject } from './project-catalog.js';

type AnyRecord = Record<string, unknown>;
type Dependency = { path: string; size: number; mtimeMs: number; sha256: string };
type Projection = AnyRecord & { schemaVersion: number; projectorVersion: string; revision: number; generatedAt: string; fingerprint: string };
type ProjectSlice = { projectId: string; project: AnyRecord; tasks: AnyRecord[]; dependencies: Dependency[]; fingerprint: string };

const schemaVersion = 3;
const projectorVersion = 'control-room-v3-project-slices';

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

function runtimeStatus(input: { card: AnyRecord; runtime: AnyRecord; pipelineRuns: AnyRecord[]; queuedRuns: AnyRecord[] }): AnyRecord {
  const runId = text(input.card.codexActiveRunId) || text(input.card.codexThreadRunId) || text(input.card.codexRunId);
  const pipelineRunId = text(input.card.codexQueuedPipelineRunId);
  if (pipelineRunId) {
    const run = input.pipelineRuns.find((entry) => text(entry.id) === pipelineRunId);
    const steps = records(run?.steps);
    const activeStep = steps.find((step) => ['pending', 'running'].includes(text(step.status)));
    const activeSkill = records(activeStep?.skills).find((skill) => ['pending', 'running'].includes(text(skill.status)));
    const status = text(run?.status) || 'unknown';
    const queueIndex = input.queuedRuns.findIndex((entry) => text(entry.id) === pipelineRunId || text((entry.payload as AnyRecord | undefined)?.runId) === pipelineRunId);
    return { runId, pipelineRunId, status, startedAt: text(activeSkill?.startedAt) || text(activeStep?.startedAt) || text(run?.resumedAt) || text(run?.startedAt), queuePosition: status === 'pending' && queueIndex >= 0 ? queueIndex + 1 : null };
  }
  const runtimeRuns = input.runtime.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object' ? input.runtime.codexSkillRuns as Record<string, AnyRecord> : {};
  const live = runtimeRuns[runId] ?? {};
  const queueIndex = input.queuedRuns.findIndex((entry) => text(entry.id) === runId || text((entry.payload as AnyRecord | undefined)?.runId) === runId);
  const status = text(live.status) || (queueIndex >= 0 ? 'pending' : 'unknown');
  return { runId, pipelineRunId: '', status, startedAt: text(live.startedAt), queuePosition: status === 'pending' && queueIndex >= 0 ? queueIndex + 1 : null };
}

function taskFrom(input: { project: DecisionOsProject; ledgerEntry: DecisionOsProject['ledgers'][number]; ledger: AnyRecord; card: AnyRecord; runtime: AnyRecord; pipelineRuns: AnyRecord[]; queuedRuns: AnyRecord[] }): AnyRecord | null {
  const markdown = readCardDescription({ decisionOsRoot: input.project.decisionOsRoot, card: input.card }).replace(/\r\n?/g, '\n');
  const labelLines = markdown.split('\n').filter((line) => /^\s*(?:#[a-z][a-z0-9-]*\s*)+$/i.test(line));
  const labels = new Set(Array.from(labelLines.join('\n').matchAll(/#([a-z][a-z0-9-]*)\b/gi), (match) => match[1].toLowerCase()));
  if (!labels.has('master-task')) return null;
  const sourceStatuses = ['task-waiting', 'task-active', 'task-complete'].filter((status) => labels.has(status));
  const ledgerName = markdown.match(/^\s*(?:\*\*)?Ledger(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const waitingText = markdown.match(/^\s*(?:\*\*)?Waiting since(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const activeText = markdown.match(/^\s*(?:\*\*)?Active since(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const rankText = markdown.match(/^\s*(?:\*\*)?Queue rank(?:\*\*)?\s*:\s*(\d+)\s*$/im)?.[1] ?? '';
  const threadId = `thread-${text(input.card.id)}`;
  const threadRef = input.ledger.threadFiles && typeof input.ledger.threadFiles === 'object' ? (input.ledger.threadFiles as AnyRecord)[threadId] : '';
  const threadFile = resolveThreadContentFile(input.project.decisionOsRoot, threadRef);
  const notes = threadFile && existsSync(threadFile) ? parseThreadMarkdown(readFileSync(threadFile, 'utf8')) : [];
  const latestThreadTime = notes.reduce((latest, note) => Math.max(latest, Date.parse(text(note.timestamp)) || Number.NEGATIVE_INFINITY), Number.NEGATIVE_INFINITY);
  const waitingTime = Number.isFinite(latestThreadTime) ? latestThreadTime : Date.parse(waitingText);
  const rank = rankText ? Number(rankText) : null;
  const run = runtimeStatus({ card: input.card, runtime: input.runtime, pipelineRuns: input.pipelineRuns, queuedRuns: input.queuedRuns });
  const processing = ['processing', 'running', 'in_progress'].includes(text(run.status));
  const queued = run.status === 'pending' && Number.isInteger(run.queuePosition) && Number(run.queuePosition) > 0;
  const cardStatus = text(input.card.status) || 'todo';
  const status = cardStatus === 'backlog' ? 'task-backlog' : cardStatus === 'done' ? 'task-complete' : processing || queued ? 'task-active' : 'task-waiting';
  const cards = records(input.ledger.cards);
  const subtasks: AnyRecord[] = [];
  const sectionMatch = markdown.match(/^##\s+(?:[A-Z]\.\s+)?Subtasks\s*$([\s\S]*?)(?=^##\s+|\s*$)/im);
  for (const line of text(sectionMatch?.[1]).split('\n')) {
    const match = line.match(/^\s*\d+[.)]\s+\[([^\]]+)]\(card:([^)]+)\)(?:\s+[—-]\s+Status:\s*(.+?))?\s*$/i);
    if (!match) continue;
    const linked = cards.find((card) => text(card.id) === match[2].trim());
    subtasks.push({ title: match[1].trim(), cardId: match[2].trim(), status: linked?.status === 'done' ? 'complete' : 'waiting', zoneId: linked ? zoneIdFor(linked, input.ledger) : 'ungrouped' });
  }
  const diagnostics: string[] = [];
  if (sourceStatuses.length !== 1) diagnostics.push('expected exactly one task status label');
  if (!ledgerName) diagnostics.push('missing Ledger');
  if (!waitingText || !Number.isFinite(waitingTime)) diagnostics.push('invalid Waiting since');
  if (sourceStatuses[0] === 'task-active' && (!activeText || !Number.isFinite(Date.parse(activeText)))) diagnostics.push('invalid Active since');
  if (rank !== null && (!Number.isInteger(rank) || rank < 1)) diagnostics.push('invalid Queue rank');
  const complete = subtasks.filter((subtask) => subtask.status === 'complete').length;
  return {
    valid: diagnostics.length === 0, masterTask: true, diagnostics,
    cardId: text(input.card.id), title: text(input.card.title) || `Card ${text(input.card.id)}`,
    projectId: input.project.id, projectName: input.project.name, projectColor: input.project.color,
    ledgerId: input.ledgerEntry.id, ledgerTitle: input.ledgerEntry.title, ledger: ledgerName,
    zoneId: zoneIdFor(input.card, input.ledger), status,
    codexRunId: run.runId, codexPipelineRunId: run.pipelineRunId, codexStatus: run.status,
    codexProcessing: processing, codexQueued: queued, codexQueuePosition: queued ? run.queuePosition : null,
    waitingSince: Number.isFinite(latestThreadTime) ? new Date(latestThreadTime).toISOString() : waitingText,
    waitingTime, activeSince: processing && run.startedAt ? run.startedAt : activeText,
    activeTime: Date.parse(processing && run.startedAt ? text(run.startedAt) : activeText), queueRank: rank,
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
  const queuedRuns = readCodexProcessQueue(project.decisionOsRoot) as unknown as AnyRecord[];
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
    queue: tasks.filter((task) => task.status === 'task-waiting').sort(compareTasks),
    active: tasks.filter((task) => task.status === 'task-active').sort(compareTasks),
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
  try {
    const persisted = JSON.parse(readFileSync(input.cacheFile, 'utf8')) as Projection;
    if (persisted.schemaVersion === schemaVersion && persisted.projectorVersion === projectorVersion) {
      const persistedSlices = records(persisted.projectSlices) as unknown as ProjectSlice[];
      const valid = persistedSlices.length > 0 && persistedSlices.every((slice) => slice.dependencies.every((entry) => dependency(entry.path)?.sha256 === entry.sha256));
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
  return {
    get(projects) {
      if (Date.now() - lastReconcileAt >= 30_000) this.reconcile(projects);
      if (!dirtyAll && dirtyProjects.size === 0 && current) return current;
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
    },
    reconcile(projects) {
      if (!current) { dirtyAll = true; lastReconcileAt = Date.now(); return true; }
      let changed = false;
      for (const slice of slices.values()) {
        if (slice.dependencies.some((entry) => {
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
      return changed || catalogChanged;
    },
  };
}
