/**
 * WHAT: Commits and projects one terminal task execution from replicated lifecycle state.
 * WHY: Process observations must not override durable cancellation status or its accepted Stop timestamp.
 */
import type {
  TaskExecutionLifecycle,
  TaskExecutionMetadata,
  TaskExecutionPhase,
} from '../../task-state/helper/task-current-state-types.js';
import { taskExecutionState } from './task-execution-runtime.js';

type AnyRecord = Record<string, unknown>;
type TerminalPhase = Extract<TaskExecutionPhase, 'succeeded' | 'failed' | 'cancelled' | 'interrupted'>;
export type TaskExecutionExternalStatus = 'complete' | 'failed' | 'cancelled' | 'interrupted';
type ExecutionRecord = {
  metadata: TaskExecutionMetadata;
  lifecycle: TaskExecutionLifecycle;
};

const terminalPhases = new Set<TaskExecutionPhase>(['succeeded', 'failed', 'cancelled', 'interrupted']);

function externalStatus(phase: TerminalPhase): TaskExecutionExternalStatus {
  return phase === 'succeeded' ? 'complete' : phase;
}

function assertFinishedAt(executionId: string, lifecycle: TaskExecutionLifecycle): string {
  const finishedAt = lifecycle.finishedAt ?? '';
  if (!Number.isFinite(Date.parse(finishedAt))) {
    throw new Error(`task_execution_finished_at_invalid:${executionId}`);
  }
  return finishedAt;
}

export function taskExecutionSettlementTimestamp(execution: ExecutionRecord | null, processSettledAt: string): string {
  const finishedAt = execution?.lifecycle.finishedAt ?? processSettledAt;
  if (!Number.isFinite(Date.parse(finishedAt))) throw new Error('invalid_task_execution_timestamp');
  return new Date(finishedAt).toISOString();
}

export function committedTaskExecutionSettlement(execution: ExecutionRecord): {
  execution: ExecutionRecord;
  phase: TerminalPhase;
  status: TaskExecutionExternalStatus;
  finishedAt: string;
} {
  const phase = execution.lifecycle.phase;
  if (!terminalPhases.has(phase)) {
    throw new Error(`task_execution_terminal_state_invalid:${execution.metadata.executionId}:${phase}`);
  }
  const terminalPhase = phase as TerminalPhase;
  return {
    execution,
    phase: terminalPhase,
    status: externalStatus(terminalPhase),
    finishedAt: assertFinishedAt(execution.metadata.executionId, execution.lifecycle),
  };
}

export async function commitTaskExecutionSettlement(input: {
  runtime: AnyRecord;
  executionId: string;
  requestedPhase: TerminalPhase;
  settledAt: string;
  summary: string;
  failureCode: string;
}): Promise<ReturnType<typeof committedTaskExecutionSettlement>> {
  const state = taskExecutionState(input.runtime);
  if (!state) throw new Error('task_execution_state_unavailable');
  let execution = state.executions.find(input.executionId);
  if (!execution) throw new Error(`task_execution_not_found:${input.executionId}`);
  if (!terminalPhases.has(execution.lifecycle.phase)) {
    const phase: TerminalPhase = execution.lifecycle.phase === 'cancelling'
      ? 'cancelled'
      : input.requestedPhase;
    execution = await state.executions.transition(input.executionId, {
      phase,
      changedAt: input.settledAt,
      result: { status: phase, summary: input.summary },
      error: phase === 'failed'
        ? { code: input.failureCode, message: input.summary }
        : null,
    });
  }
  return committedTaskExecutionSettlement(execution);
}
