/**
 * WHAT: Cancels one epoch-4 execution on the node that owns its live process.
 * WHY: Cancellation must persist `cancelling` before signalling and must never target a process from mutable card state.
 */
import { signalCodexProcessTree } from './reconcile-terminal-codex-process.js';
import { isSameCodexProcess } from './codex-process-identity.js';
import {
  taskExecutionNodeId,
  taskExecutionProcess,
  taskExecutionState,
  type TaskExecutionCancellationResult,
} from './task-execution-runtime.js';

type AnyRecord = Record<string, unknown>;

const terminalPhases = new Set(['succeeded', 'failed', 'cancelled', 'interrupted']);

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
    return { ok: true, statusCode: 200, executionId: input.executionId, executorNodeId: localNodeId, phase, revision: execution.lifecycle.revision };
  }
  if (phase === 'preparing' || phase === 'queued') {
    const cancelled = await state.executions.transition(input.executionId, {
      phase: 'cancelled',
      result: { status: 'cancelled', summary: 'Cancelled by operator.' },
    });
    return {
      ok: true,
      statusCode: 202,
      executionId: input.executionId,
      executorNodeId: localNodeId,
      phase: cancelled.lifecycle.phase,
      revision: cancelled.lifecycle.revision,
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
  const runtimeRuns = input.runtime.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object'
    ? input.runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};
  const runtimeRun = runtimeRuns[execution.metadata.sessionId];
  if (runtimeRun) runtimeRun.cancelRequestedAt = cancelling.lifecycle.phaseSince;
  if (!signalCodexProcessTree({ child: process.child ?? undefined, pid: process.processId, signal: 'SIGTERM' })) {
    await state.executions.transition(input.executionId, {
      phase: 'failed',
      error: { code: 'task_execution_cancel_signal_failed', message: 'Could not signal the live execution process.' },
    });
    return {
      ok: false,
      statusCode: 500,
      error: 'task_execution_cancel_signal_failed',
      executionId: input.executionId,
      executorNodeId: localNodeId,
    };
  }
  const forceStop = setTimeout(() => {
    if (isSameCodexProcess(process.processId, process.processStartTime)) {
      signalCodexProcessTree({ child: process.child ?? undefined, pid: process.processId, signal: 'SIGKILL' });
    }
  }, 2_000);
  forceStop.unref?.();
  return {
    ok: true,
    statusCode: 202,
    executionId: input.executionId,
    executorNodeId: localNodeId,
    phase: cancelling.lifecycle.phase,
    revision: cancelling.lifecycle.revision,
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
