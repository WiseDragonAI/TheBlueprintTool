/**
 * WHAT: Recovers locally assigned non-terminal epoch-4 executions from replicated state.
 * WHY: Startup must adopt exact live processes, interrupt missing processes, and wake queued work without consulting legacy queues or card leases.
 */
import { isSameCodexProcess } from './codex-process-identity.js';
import { monitorAdoptedTaskExecution } from './monitor-adopted-task-execution.js';
import {
  finalizeTaskExecutionArtifacts,
  removeTaskExecutionProcess,
  taskExecutionNodeId,
  taskExecutionProcess,
  taskExecutionState,
} from './task-execution-runtime.js';

type AnyRecord = Record<string, unknown>;

export type TaskExecutionRecoveryResult = {
  adopted: string[];
  interrupted: string[];
  queued: string[];
  failed: string[];
};

function reportFailure(runtime: AnyRecord, executionId: string, error: unknown): void {
  if (typeof runtime.onCodexBackgroundError !== 'function') return;
  try {
    runtime.onCodexBackgroundError({
      operation: 'recover-task-execution',
      error: error instanceof Error ? error : new Error(String(error)),
      context: { executionId },
    });
  } catch {
    // Recovery diagnostics cannot fail the remaining execution pass.
  }
}

export async function recoverTaskExecutions(runtime: AnyRecord): Promise<TaskExecutionRecoveryResult> {
  const state = taskExecutionState(runtime);
  const result: TaskExecutionRecoveryResult = { adopted: [], interrupted: [], queued: [], failed: [] };
  if (!state) return result;
  const nodeId = taskExecutionNodeId(runtime);
  const active = (['starting', 'running', 'cancelling'] as const)
    .flatMap((phase) => state.executions.byPhase(phase))
    .filter((record) => record.lifecycle.executorNodeId === nodeId)
    .sort((left, right) => left.metadata.executionId.localeCompare(right.metadata.executionId));

  for (const execution of active) {
    const executionId = execution.metadata.executionId;
    try {
      const registered = taskExecutionProcess(runtime, executionId);
      if (registered && isSameCodexProcess(registered.processId, registered.processStartTime)) {
        monitorAdoptedTaskExecution(runtime, executionId);
        result.adopted.push(executionId);
        continue;
      }
      await state.executions.transition(executionId, {
        phase: 'interrupted',
        result: { status: 'interrupted', summary: 'The executor restarted without the registered process.' },
      });
      if (registered) {
        await finalizeTaskExecutionArtifacts({
          runtime,
          executionId,
          jsonl: registered.stdoutFile,
          stderr: registered.stderrFile,
          telemetry: `${registered.stdoutFile}.telemetry.jsonl`,
        });
        removeTaskExecutionProcess(runtime, executionId);
      }
      result.interrupted.push(executionId);
    } catch (error) {
      result.failed.push(executionId);
      reportFailure(runtime, executionId, error);
    }
  }

  result.queued = state.executions.byPhase('queued')
    .filter((record) => record.lifecycle.executorNodeId === nodeId)
    .map((record) => record.metadata.executionId)
    .sort();
  if (result.queued.length > 0 && typeof runtime.scheduleCodexProcesses === 'function') {
    await (runtime.scheduleCodexProcesses as () => Promise<unknown>)();
  }
  return result;
}
