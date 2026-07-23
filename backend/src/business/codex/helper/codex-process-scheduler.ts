/**
 * WHAT: Selects the oldest dependency-ready epoch-4 execution across one project.
 * WHY: Direct and saved-pipeline work must share one replicated queue; only temporary legacy runs remain isolated until J.8.
 */
import { readCodexPipelineStore } from './codex-pipeline-store.js';
import { maxConcurrentCodexProcesses, runNextPipelineSkill, runPipelineExecution } from './codex-pipeline-runner.js';
import { startThreadCodexProcessController } from '../controller/start-thread-codex-process-controller.js';
import { continueCardSkillRunController } from '../controller/continue-card-skill-run-controller.js';
import { taskExecutionNodeId, taskExecutionState } from './task-execution-runtime.js';

type AnyRecord = Record<string, unknown>;

function runnableLegacyPipelineRuns(decisionOsRoot: string, runtime?: AnyRecord) {
  const state = runtime ? taskExecutionState(runtime) : null;
  return readCodexPipelineStore({ decisionOsRoot }).store.runs.filter((run) => (
    run.executionMode !== 'federated'
    && (run.temporary || (state?.executions.byPipelineRunId(run.id).length ?? 0) === 0)
    && (run.status === 'pending' || run.status === 'running')
    && run.steps.some((step) => step.skills.some((skill) => skill.status === 'pending'))
    && !run.steps.some((step) => step.skills.some((skill) => skill.status === 'running'))
  ));
}

function runnableExecutions(runtime: AnyRecord) {
  const state = taskExecutionState(runtime);
  if (!state) return [];
  return state.executions.byPhase('queued')
    .filter((record) => (
      record.lifecycle.executorNodeId === taskExecutionNodeId(runtime)
      && (
        record.metadata.kind === 'thread'
        || record.metadata.kind === 'continuation'
        || record.metadata.kind === 'pipeline-skill'
      )
      && (!record.metadata.predecessorExecutionId
        || state.executions.find(record.metadata.predecessorExecutionId)?.lifecycle.phase === 'succeeded')
    ))
    .sort((left, right) => (
      left.metadata.requestedAt.localeCompare(right.metadata.requestedAt)
      || left.metadata.executionId.localeCompare(right.metadata.executionId)
    ));
}

export function runningCodexProcessCount(runtime: AnyRecord): number {
  const sharedCount = runtime.globalCodexRunningProcessCount;
  if (typeof sharedCount === 'function') return Math.max(0, Number(sharedCount()) || 0);
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
  return Object.values(runs).filter((run) => run.status === 'running').length;
}

export function nextPendingCodexProcessCreatedAt(decisionOsRoot: string, runtime?: AnyRecord): string | null {
  const pipeline = runnableLegacyPipelineRuns(decisionOsRoot, runtime)[0];
  const execution = runtime ? runnableExecutions(runtime)[0] : null;
  if (!pipeline) return execution?.metadata.requestedAt ?? null;
  if (!execution) return pipeline.createdAt;
  return execution.metadata.requestedAt <= pipeline.createdAt ? execution.metadata.requestedAt : pipeline.createdAt;
}

export function pendingCodexProcessEntries(decisionOsRoot: string, runtime?: AnyRecord): Array<{ id: string; createdAt: string; order: number }> {
  return [
    ...runnableLegacyPipelineRuns(decisionOsRoot, runtime).map((run, order) => ({ id: run.id, createdAt: run.createdAt, order })),
    ...(runtime ? runnableExecutions(runtime).map((record, order) => ({
      id: record.metadata.executionId,
      createdAt: record.metadata.requestedAt,
      order: 1_000_000 + order,
    })) : []),
  ];
}

export function unifiedCodexQueuePosition(input: { decisionOsRoot: string; id: string; createdAt: string; runtime?: AnyRecord }): number {
  const sharedPosition = input.runtime?.globalCodexQueuePosition;
  if (typeof sharedPosition === 'function') return Math.max(1, Number(sharedPosition(input.id)) || 1);
  const pending = pendingCodexProcessEntries(input.decisionOsRoot, input.runtime)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.order - right.order);
  const index = pending.findIndex((entry) => entry.id === input.id);
  return index < 0 ? 1 : index + 1;
}

async function failClaim(input: {
  state: NonNullable<ReturnType<typeof taskExecutionState>>;
  executionId: string;
  code: string;
  message: string;
}): Promise<void> {
  const current = input.state.executions.find(input.executionId);
  if (current?.lifecycle.phase !== 'starting') return;
  await input.state.executions.transition(input.executionId, {
    phase: 'failed',
    error: { code: input.code, message: input.message },
  });
}

function reportDispatchFailure(runtime: AnyRecord, record: ReturnType<NonNullable<ReturnType<typeof taskExecutionState>>['executions']['find']>, error: unknown): void {
  if (!record || typeof runtime.onCodexBackgroundError !== 'function') return;
  try {
    runtime.onCodexBackgroundError({
      operation: 'task-execution-dispatch-failed',
      error: error instanceof Error ? error : new Error(String(error)),
      context: {
        executionId: record.metadata.executionId,
        taskId: record.metadata.taskId,
        sessionId: record.metadata.sessionId,
      },
    });
  } catch {
    // Diagnostics must not replace execution-scoped failure settlement.
  }
}

async function runCodexProcessSchedule(input: { decisionOsRoot: string; runtime: AnyRecord; launchLimit?: number }): Promise<AnyRecord> {
  const launched: AnyRecord[] = [];
  const capacity = maxConcurrentCodexProcesses(input.runtime);
  const launchLimit = Math.max(1, input.launchLimit ?? Number.POSITIVE_INFINITY);
  while (runningCodexProcessCount(input.runtime) < capacity && launched.length < launchLimit) {
    const pipeline = runnableLegacyPipelineRuns(input.decisionOsRoot, input.runtime)[0];
    const execution = runnableExecutions(input.runtime)[0];
    if (!pipeline && !execution) break;
    const launchExecution = Boolean(execution && (!pipeline || execution.metadata.requestedAt <= pipeline.createdAt));
    if (launchExecution && execution) {
      const state = taskExecutionState(input.runtime);
      if (!state) break;
      const claimed = await state.executions.transition(execution.metadata.executionId, { phase: 'starting' });
      const launchPayload = {
        ledgerId: claimed.metadata.ledgerId,
        cardId: claimed.metadata.sourceCardId,
        threadId: `thread-${claimed.metadata.sourceCardId}`,
        runId: claimed.metadata.sessionId,
        reservedRunId: claimed.metadata.sessionId,
        executionId: claimed.metadata.executionId,
        codexModel: claimed.metadata.model,
        codexEffort: claimed.metadata.effort,
        epoch4Dispatch: true,
      };
      let result: AnyRecord;
      let dispatchFailureReported = false;
      try {
        result = claimed.metadata.kind === 'pipeline-skill'
          ? await runPipelineExecution({
            decisionOsRoot: input.decisionOsRoot,
            runtime: input.runtime,
            executionId: claimed.metadata.executionId,
          })
          : claimed.metadata.kind === 'continuation'
          ? await continueCardSkillRunController({ action_payload: launchPayload, runtime_state: input.runtime })
          : await startThreadCodexProcessController({ action_payload: launchPayload, runtime_state: input.runtime });
      } catch (error) {
        result = {
          ok: false,
          code: 'task_execution_dispatch_failed',
          error: error instanceof Error ? error.message : String(error),
        };
        reportDispatchFailure(input.runtime, claimed, error);
        dispatchFailureReported = true;
      }
      launched.push(result);
      if (result.ok === false) {
        if (!dispatchFailureReported) {
          reportDispatchFailure(input.runtime, claimed, result.error ?? result.code ?? 'Dispatch failed.');
        }
        await failClaim({
          state,
          executionId: claimed.metadata.executionId,
          code: String(result.code ?? 'task_execution_dispatch_failed'),
          message: String(result.error ?? 'Dispatch failed.'),
        });
        if (typeof input.runtime.onCodexRunSettled === 'function') input.runtime.onCodexRunSettled({
          ledgerId: claimed.metadata.ledgerId,
          cardId: claimed.metadata.sourceCardId,
          outputCardId: claimed.metadata.ownerCardId,
          threadId: `thread-${claimed.metadata.sourceCardId}`,
          runId: claimed.metadata.sessionId,
          executionId: claimed.metadata.executionId,
          status: 'failed',
        });
      }
      continue;
    }
    if (pipeline) {
      const result = await runNextPipelineSkill({ decisionOsRoot: input.decisionOsRoot, runtime: input.runtime, pipelineRunId: pipeline.id });
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
