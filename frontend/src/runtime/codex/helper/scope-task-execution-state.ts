/**
 * WHAT: Derives one source card's execution history from its canonical task-group summary.
 * WHY: Master and sibling executions share a durable task id but own separate threads and Codex Logs.
 */
import type {
  TaskExecutionStateSession,
  TaskExecutionStateSummary,
} from '../../../../../shared/schemas/task-execution-presentation-types.js';

export function scopeTaskExecutionState(
  summary: TaskExecutionStateSummary,
  sourceCardId: string,
): TaskExecutionStateSummary {
  const sessions: TaskExecutionStateSession[] = summary.sessions.flatMap((session) => {
    const executions = session.executions.filter((execution) => execution.sourceCardId === sourceCardId);
    return executions.length > 0 ? [{ ...session, executions }] : [];
  });
  const executions = sessions.flatMap((session) => session.executions);
  const executionIds = new Set(executions.map((execution) => execution.executionId));
  const activeExecutionIds = summary.activeExecutionIds.filter((executionId) => executionIds.has(executionId));
  return {
    ...summary,
    activeExecutionIds,
    defaultExecutionId: activeExecutionIds.at(-1) ?? executions.at(-1)?.executionId ?? null,
    sessions,
  };
}
