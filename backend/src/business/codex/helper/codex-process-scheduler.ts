/**
 * WHAT: Selects the oldest dependency-ready epoch-4 execution across one project.
 * WHY: Direct, continuation, and pipeline work must share one replicated queue and one lifecycle authority.
 */
import { assertCodexPipelineStoreAvailable, readCodexPipelineStore } from './codex-pipeline-store.js';
import {
  maxConcurrentCodexProcesses,
  federatedPipelineExecutionReady,
  outputFileForPipelineStep,
  resolvePipelineLedgerContext,
  runPipelineExecution,
} from './codex-pipeline-runner.js';
import { startThreadCodexProcessController } from '../controller/start-thread-codex-process-controller.js';
import { continueCardSkillRunController } from '../controller/continue-card-skill-run-controller.js';
import { taskExecutionNodeId, taskExecutionState } from './task-execution-runtime.js';

type AnyRecord = Record<string, unknown>;

function runnableExecutions(decisionOsRoot: string, runtime: AnyRecord) {
  const state = taskExecutionState(runtime);
  // WHAT: Treat a project without installed task execution state as an empty queue.
  // WHY: Scheduler ticks must remain safe while project runtime installation is incomplete.
  if (!state) return [];
  const queued = state.executions.byPhase('queued')
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
  // WHAT: Settle an empty in-memory queue without opening the project's pipeline store.
  // WHY: The one-second safety poll must perform zero disk reads for idle projects.
  if (queued.length === 0) return [];
  // WHAT: Return queued direct work without opening pipeline-only durable state.
  // WHY: Thread and continuation readiness is fully owned by replicated execution state.
  if (!queued.some((record) => record.metadata.kind === 'pipeline-skill')) return queued;

  const normalized = readCodexPipelineStore({ decisionOsRoot });
  assertCodexPipelineStoreAvailable(normalized);
  const pipelineRuns = new Map(normalized.store.runs.map((run) => [run.id, run]));
  const contexts = new Map<string, ReturnType<typeof resolvePipelineLedgerContext>>();
  const pipelineReady = (record: ReturnType<typeof state.executions.find>): boolean => {
    // WHAT: Admit non-pipeline work without pipeline topology checks.
    // WHY: Only pipeline skills own run, step, and result-destination dependencies.
    if (!record || record.metadata.kind !== 'pipeline-skill') return true;
    const run = pipelineRuns.get(record.metadata.pipelineRunId ?? '');
    const member = run?.steps
      .flatMap((step) => step.skills.map((skill) => ({ step, skill })))
      .find(({ skill }) => skill.executionId === record.metadata.executionId);
    // WHAT: Keep a pipeline execution queued when its immutable run membership is absent.
    // WHY: Scheduling without exact topology would claim work without an authoritative step owner.
    if (!run || !member) return false;
    // WHAT: Keep a federated pipeline execution queued until its remote dependencies are ready.
    // WHY: The assigned executor cannot safely launch before federated predecessor state settles.
    if (run.executionMode === 'federated'
      && !federatedPipelineExecutionReady(runtime, record.metadata.executionId)) return false;
    // WHAT: Admit a ready federated execution without resolving a local result destination.
    // WHY: Its output owner is managed by the federated execution path.
    if (run.executionMode === 'federated') return true;
    // WHAT: Resolve each local pipeline ledger context once per scheduler inspection.
    // WHY: Multiple queued skills in one ledger must not repeat filesystem-backed context construction.
    if (!contexts.has(run.ledgerId)) {
      contexts.set(run.ledgerId, resolvePipelineLedgerContext({ decisionOsRoot, runtime, ledgerId: run.ledgerId }));
    }
    const context = contexts.get(run.ledgerId);
    // WHAT: Admit a local pipeline execution only when its selected Markdown result owner resolves safely.
    // WHY: Card-backed and cardless runs require a durable output destination before claiming queue capacity.
    return Boolean(context && outputFileForPipelineStep({
      context,
      decisionOsRoot,
      run,
      step: member.step,
    }));
  };
  return queued.filter(pipelineReady);
}

export function runningCodexProcessCount(runtime: AnyRecord): number {
  const sharedCount = runtime.globalCodexRunningProcessCount;
  if (typeof sharedCount === 'function') return Math.max(0, Number(sharedCount()) || 0);
  const registry = runtime.taskExecutionProcesses instanceof Map
    ? runtime.taskExecutionProcesses as Map<string, unknown>
    : new Map<string, unknown>();
  return registry.size;
}

export function nextPendingCodexProcessCreatedAt(decisionOsRoot: string, runtime?: AnyRecord): string | null {
  return runtime ? runnableExecutions(decisionOsRoot, runtime)[0]?.metadata.requestedAt ?? null : null;
}

export function pendingCodexProcessEntries(decisionOsRoot: string, runtime?: AnyRecord): Array<{ id: string; createdAt: string; order: number }> {
  return runtime ? runnableExecutions(decisionOsRoot, runtime).map((record, order) => ({
    id: record.metadata.executionId,
    createdAt: record.metadata.requestedAt,
    order,
  })) : [];
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
    const execution = runnableExecutions(input.decisionOsRoot, input.runtime)[0];
    if (!execution) break;
    {
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
        const failed = state.executions.find(claimed.metadata.executionId);
        if (failed && typeof input.runtime.onCodexRunSettled === 'function') {
          await input.runtime.onCodexRunSettled({
            ledgerId: claimed.metadata.ledgerId,
            cardId: claimed.metadata.sourceCardId,
            outputCardId: claimed.metadata.ownerCardId,
            threadId: `thread-${claimed.metadata.sourceCardId}`,
            runId: claimed.metadata.sessionId,
            executionId: claimed.metadata.executionId,
            status: 'failed',
            finishedAt: failed.lifecycle.finishedAt,
            ...(claimed.metadata.pipelineRunId ? {
              pipelineRunId: claimed.metadata.pipelineRunId,
              pipelineStatus: 'failed',
              pipelineTerminal: true,
            } : {}),
          });
        }
      }
      continue;
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
