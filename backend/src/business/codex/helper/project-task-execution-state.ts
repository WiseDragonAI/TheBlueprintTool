/**
 * WHAT: Projects one task's synchronized executions into a deterministic session hierarchy.
 * WHY: The Codex Log needs task history without parsing logs or reconstructing ownership from card aliases.
 */
import type {
  TaskExecutionStateItem,
  TaskExecutionStateSession,
  TaskExecutionStateSummary,
} from '../../../../../shared/schemas/task-execution-presentation-types.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';

type ExecutionRecord = ReturnType<ProjectTaskState['executions']['byTaskId']>[number];

// WHAT: Treat every admitted non-terminal phase as active in the task summary.
// WHY: Queued and cancelling executions must remain selectable beside running pipeline work.
const activePhases = new Set(['preparing', 'queued', 'starting', 'running', 'cancelling']);

function executionItem(record: ExecutionRecord, queuePosition: number | null): TaskExecutionStateItem {
  // WHAT: Reduce one replicated record to lifecycle and artifact-availability presentation fields.
  // WHY: Register candidates, content hashes, and artifact byte metadata are backend synchronization details.
  return {
    executionId: record.metadata.executionId,
    sessionId: record.metadata.sessionId,
    sourceCardId: record.metadata.sourceCardId,
    kind: record.metadata.kind,
    phase: record.lifecycle.phase,
    requestedAt: record.metadata.requestedAt,
    startedAt: record.lifecycle.startedAt,
    finishedAt: record.lifecycle.finishedAt,
    model: record.metadata.model,
    effort: record.metadata.effort,
    executorNodeId: record.lifecycle.executorNodeId,
    revision: record.lifecycle.revision,
    queuePosition,
    error: record.lifecycle.error,
    artifacts: {
      jsonl: record.artifacts.jsonl !== null,
      stderr: record.artifacts.stderr !== null,
      telemetry: record.artifacts.telemetry !== null,
      result: record.artifacts.result !== null,
    },
  };
}

export function projectTaskExecutionState(input: {
  taskId: string;
  state: ProjectTaskState;
  queuePosition?: (record: ExecutionRecord) => number | null;
}): TaskExecutionStateSummary {
  const executions = input.state.executions.byTaskId(input.taskId).map((record) => executionItem(
    record,
    record.lifecycle.phase === 'queued' ? input.queuePosition?.(record) ?? null : null,
  ));
  const sessionMap = new Map<string, TaskExecutionStateItem[]>();
  // WHAT: Derive sessions from the session identity already stored on every execution.
  // WHY: Persisting another session entity would duplicate synchronized execution metadata.
  for (const execution of executions) {
    const session = sessionMap.get(execution.sessionId) ?? [];
    session.push(execution);
    sessionMap.set(execution.sessionId, session);
  }
  const sessions: TaskExecutionStateSession[] = [...sessionMap.entries()]
    .map(([sessionId, entries]) => ({
      sessionId,
      requestedAt: entries[0]?.requestedAt ?? '',
      executions: entries,
    }))
    .sort((left, right) => (
      left.requestedAt.localeCompare(right.requestedAt)
      || left.sessionId.localeCompare(right.sessionId)
    ));
  // WHAT: Preserve every valid active execution in repository order.
  // WHY: Pipeline runs can own several simultaneous executions and must not be collapsed into a conflict.
  const activeExecutionIds = executions
    .filter((execution) => activePhases.has(execution.phase))
    .map((execution) => execution.executionId);
  // WHAT: Default to the latest active execution, then the latest terminal execution.
  // WHY: Initial display needs one deterministic target without hiding the complete history.
  return {
    taskId: input.taskId,
    activeExecutionIds,
    defaultExecutionId: activeExecutionIds.at(-1) ?? executions.at(-1)?.executionId ?? null,
    sessions,
  };
}
