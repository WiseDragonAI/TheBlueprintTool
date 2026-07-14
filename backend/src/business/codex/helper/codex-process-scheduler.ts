/**
 * WHAT: Selects the oldest pending Codex job across pipeline and thread queues.
 * WHY: One project-wide process limit and FIFO order must govern every launch surface.
 */
import { readCodexPipelineStore } from './codex-pipeline-store.js';
import { markCodexProcessQueueItemRunning, readCodexProcessQueue, removeCodexProcessQueueItem } from './codex-process-queue.js';
import { maxConcurrentCodexProcesses, runNextPipelineSkill } from './codex-pipeline-runner.js';
import { startThreadCodexProcessController } from '../controller/start-thread-codex-process-controller.js';
import { continueCardSkillRunController } from '../controller/continue-card-skill-run-controller.js';

type AnyRecord = Record<string, unknown>;

export function runningCodexProcessCount(runtime: AnyRecord): number {
  const sharedCount = runtime.globalCodexRunningProcessCount;
  if (typeof sharedCount === 'function') return Math.max(0, Number(sharedCount()) || 0);
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
  return Object.values(runs).filter((run) => run.status === 'running').length;
}

export function nextPendingCodexProcessCreatedAt(decisionOsRoot: string): string | null {
  const pipeline = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((run) => run.status === 'pending');
  const process = readCodexProcessQueue(decisionOsRoot).find((item) => item.status === 'pending');
  if (!pipeline) return process?.createdAt ?? null;
  if (!process) return pipeline.createdAt;
  return process.createdAt <= pipeline.createdAt ? process.createdAt : pipeline.createdAt;
}

export function pendingCodexProcessEntries(decisionOsRoot: string): Array<{ id: string; createdAt: string; order: number }> {
  return [
    ...readCodexPipelineStore({ decisionOsRoot }).store.runs.filter((run) => run.status === 'pending').map((run, order) => ({ id: run.id, createdAt: run.createdAt, order })),
    ...readCodexProcessQueue(decisionOsRoot).filter((item) => item.status === 'pending').map((item, order) => ({ id: item.id, createdAt: item.createdAt, order: 1_000_000 + order })),
  ];
}

export function unifiedCodexQueuePosition(input: { decisionOsRoot: string; id: string; createdAt: string; runtime?: AnyRecord }): number {
  const sharedPosition = input.runtime?.globalCodexQueuePosition;
  if (typeof sharedPosition === 'function') return Math.max(1, Number(sharedPosition(input.id)) || 1);
  const pending = [
    ...pendingCodexProcessEntries(input.decisionOsRoot),
  ].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.order - right.order);
  const index = pending.findIndex((entry) => entry.id === input.id);
  return index < 0 ? 1 : index + 1;
}

async function runCodexProcessSchedule(input: { decisionOsRoot: string; runtime: AnyRecord; launchLimit?: number }): Promise<AnyRecord> {
  const launched: AnyRecord[] = [];
  const capacity = maxConcurrentCodexProcesses(input.runtime);
  const launchLimit = Math.max(1, input.launchLimit ?? Number.POSITIVE_INFINITY);
  while (runningCodexProcessCount(input.runtime) < capacity && launched.length < launchLimit) {
    const pipeline = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot }).store.runs.find((run) => run.status === 'pending');
    const thread = readCodexProcessQueue(input.decisionOsRoot).find((item) => item.status === 'pending');
    if (!pipeline && !thread) break;
    const launchThread = Boolean(thread && (!pipeline || thread.createdAt <= pipeline.createdAt));
    if (launchThread && thread) {
      const claimed = markCodexProcessQueueItemRunning(input.decisionOsRoot, thread.id);
      if (!claimed) break;
      const result = claimed.kind === 'continuation'
        ? await continueCardSkillRunController({ action_payload: { ...claimed.payload, queueItemId: claimed.id, queueDispatch: true }, runtime_state: input.runtime })
        : await startThreadCodexProcessController({ action_payload: { ...claimed.payload, reservedRunId: claimed.id, queueDispatch: true }, runtime_state: input.runtime });
      launched.push(result);
      if (result.ok === false) removeCodexProcessQueueItem(input.decisionOsRoot, thread.id);
      if (result.ok === false) break;
      continue;
    }
    if (pipeline) {
      const result = runNextPipelineSkill({ decisionOsRoot: input.decisionOsRoot, runtime: input.runtime, pipelineRunId: pipeline.id });
      launched.push(result);
      if (result.ok === false || !result.skillRun) break;
    }
  }
  return { ok: launched.every((entry) => entry.ok !== false), launched, capacity };
}

export function scheduleCodexProcesses(input: { decisionOsRoot: string; runtime: AnyRecord; launchLimit?: number }): Promise<AnyRecord> {
  const active = input.runtime.codexProcessSchedulePromise;
  if (active instanceof Promise) return active as Promise<AnyRecord>;
  const schedule = runCodexProcessSchedule(input).finally(() => {
    if (input.runtime.codexProcessSchedulePromise === schedule) delete input.runtime.codexProcessSchedulePromise;
  });
  Object.defineProperty(input.runtime, 'codexProcessSchedulePromise', { value: schedule, writable: true, configurable: true, enumerable: false });
  return schedule;
}
