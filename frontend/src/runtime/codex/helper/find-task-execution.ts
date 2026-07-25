/**
 * WHAT: Finds one execution inside a task execution summary.
 * WHY: Polling and rendering must use the same task-session-execution lookup rule.
 */
import type {
  TaskExecutionStateItem,
  TaskExecutionStateSummary,
} from '../../../../../shared/schemas/task-execution-presentation-types.js';

export function findTaskExecution(
  summary: TaskExecutionStateSummary | null,
  executionId: string,
): TaskExecutionStateItem | null {
  if (!summary) return null;
  for (const session of summary.sessions) {
    const execution = session.executions.find((candidate) => candidate.executionId === executionId);
    if (execution) return execution;
  }
  return null;
}
