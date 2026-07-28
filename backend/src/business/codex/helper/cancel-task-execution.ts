/**
 * WHAT: Cancels one epoch-4 execution on the node that owns its live process.
 * WHY: Cancellation must persist `cancelling` before signalling and must never target a process from mutable card state.
 */
import { signalCodexProcessTree } from './reconcile-terminal-codex-process.js';
import { isSameCodexProcess } from './codex-process-identity.js';
import {
  taskExecutionNodeId,
  taskExecutionProcess,
  scheduleTaskExecutionCancellationDeadline,
  taskExecutionState,
  type TaskExecutionCancellationResult,
} from './task-execution-runtime.js';

type AnyRecord = Record<string, unknown>;

const terminalPhases = new Set(['succeeded', 'failed', 'cancelled', 'interrupted']);

async function publishQueuedCancellation(runtime: AnyRecord, execution: {
  metadata: {
    ledgerId: string;
    sourceCardId: string;
    ownerCardId: string;
    sessionId: string;
    executionId: string;
  };
  lifecycle: { finishedAt: string | null };
}): Promise<void> {
  try {
    if (typeof runtime.onCodexRunSettled === 'function') {
      await runtime.onCodexRunSettled({
        ledgerId: execution.metadata.ledgerId,
        cardId: execution.metadata.sourceCardId,
        outputCardId: execution.metadata.ownerCardId,
        threadId: `thread-${execution.metadata.sourceCardId}`,
        runId: execution.metadata.sessionId,
        executionId: execution.metadata.executionId,
        status: 'cancelled',
        finishedAt: execution.lifecycle.finishedAt,
      });
    }
    if (typeof runtime.scheduleCodexProcesses === 'function') await runtime.scheduleCodexProcesses();
  } catch (error) {
    if (typeof runtime.onCodexBackgroundError === 'function') {
      runtime.onCodexBackgroundError({
        operation: 'task-execution-cancellation-notification',
        error,
        context: { executionId: execution.metadata.executionId },
      });
    }
  }
}

export async function cancelTaskExecutionLocally(input: {
  runtime: AnyRecord;
  executionId: string;
}): Promise<TaskExecutionCancellationResult> {
  const state = taskExecutionState(input.runtime);
  if (!state) return { ok: false, statusCode: 503, error: 'task_execution_state_unavailable', executionId: input.executionId };
  const execution = state.executions.find(input.executionId);
  if (!execution) return { ok: false, statusCode: 404, error: 'task_execution_not_found', executionId: input.executionId };
  const localNodeId = taskExecutionNodeId(input.runtime);
  if (execution.lifecycle.executorNodeId !== localNodeId) {
    return {
      ok: false,
      statusCode: 409,
      error: 'task_execution_wrong_executor',
      executionId: input.executionId,
      executorNodeId: execution.lifecycle.executorNodeId,
    };
  }
  const phase = execution.lifecycle.phase;
  if (terminalPhases.has(phase)) {
    return {
      ok: true,
      statusCode: 200,
      executionId: input.executionId,
      executorNodeId: localNodeId,
      phase,
      revision: execution.lifecycle.revision,
      finishedAt: execution.lifecycle.finishedAt ?? undefined,
    };
  }
  if (phase === 'preparing' || phase === 'queued') {
    const cancelled = await state.executions.transition(input.executionId, {
      phase: 'cancelled',
      result: { status: 'cancelled', summary: 'Cancelled by operator.' },
    });
    await publishQueuedCancellation(input.runtime, cancelled);
    return {
      ok: true,
      statusCode: 202,
      executionId: input.executionId,
      executorNodeId: localNodeId,
      phase: cancelled.lifecycle.phase,
      revision: cancelled.lifecycle.revision,
      finishedAt: cancelled.lifecycle.finishedAt ?? undefined,
      cancellationRequested: true,
    };
  }
  if (phase === 'cancelling') {
    return {
      ok: true,
      statusCode: 202,
      executionId: input.executionId,
      executorNodeId: localNodeId,
      phase,
      revision: execution.lifecycle.revision,
      finishedAt: execution.lifecycle.finishedAt ?? undefined,
      cancellationRequested: true,
    };
  }
  const process = taskExecutionProcess(input.runtime, input.executionId);
  if (!process || (process.child ? process.child.exitCode !== null : !isSameCodexProcess(process.processId, process.processStartTime))) {
    return {
      ok: false,
      statusCode: 409,
      error: 'task_execution_process_not_live',
      executionId: input.executionId,
      executorNodeId: localNodeId,
    };
  }
  const cancelling = await state.executions.transition(input.executionId, { phase: 'cancelling' });
  const finishedAt = cancelling.lifecycle.finishedAt;
  if (!finishedAt) throw new Error(`task_execution_cancel_timestamp_missing:${input.executionId}`);
  const runtimeRuns = input.runtime.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object'
    ? input.runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};
  const runtimeRun = runtimeRuns[execution.metadata.sessionId];
  if (runtimeRun) {
    runtimeRun.cancelRequestedAt = finishedAt;
    runtimeRun.finishedAt = finishedAt;
  }
  const processTarget = { child: process.child ?? undefined, pid: process.processId };
  const termSignalled = signalCodexProcessTree({ ...processTarget, signal: 'SIGTERM' });
  const deadlineAt = new Date(Date.parse(finishedAt) + 2_000).toISOString();
  scheduleTaskExecutionCancellationDeadline({
    runtime: input.runtime,
    executionId: input.executionId,
    deadlineAt,
    onDeadline: () => {
      if (isSameCodexProcess(process.processId, process.processStartTime)) {
        signalCodexProcessTree({ ...processTarget, signal: 'SIGKILL' });
      }
    },
  });
  if (!termSignalled && !signalCodexProcessTree({ ...processTarget, signal: 'SIGKILL' })) {
    return {
      ok: false,
      statusCode: 500,
      error: 'task_execution_cancel_signal_failed',
      executionId: input.executionId,
      executorNodeId: localNodeId,
    };
  }
  return {
    ok: true,
    statusCode: 202,
    executionId: input.executionId,
    executorNodeId: localNodeId,
    phase: cancelling.lifecycle.phase,
    revision: cancelling.lifecycle.revision,
    finishedAt,
    cancellationRequested: true,
  };
}

export async function cancelTaskExecution(input: {
  runtime: AnyRecord;
  executionId: string;
}): Promise<TaskExecutionCancellationResult> {
  const state = taskExecutionState(input.runtime);
  const execution = state?.executions.find(input.executionId);
  if (!execution) return { ok: false, statusCode: 404, error: 'task_execution_not_found', executionId: input.executionId };
  if (execution.lifecycle.executorNodeId === taskExecutionNodeId(input.runtime)) {
    return cancelTaskExecutionLocally(input);
  }
  const route = input.runtime.routeTaskExecutionCancellation;
  if (typeof route !== 'function') {
    return {
      ok: false,
      statusCode: 503,
      error: 'assigned_node_unreachable',
      executionId: input.executionId,
      executorNodeId: execution.lifecycle.executorNodeId,
    };
  }
  return route(input.executionId, execution.lifecycle.executorNodeId) as Promise<TaskExecutionCancellationResult>;
}
