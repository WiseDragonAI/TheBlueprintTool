/**
 * WHAT: Validates, merges, and projects executor-produced presentation events on replica backends.
 * WHY: Browser polling must read a bounded local view without making the replica an execution authority.
 */
import type {
  TaskExecutionPresentation,
  TaskExecutionPresentationEvent,
  TaskExecutionPresentationUpdate,
} from '../../../../../shared/schemas/task-execution-presentation-types.js';
import type { ReplicatedTaskExecutionRecord } from '../../task-state/helper/task-execution-repository.js';

const presentationKinds = new Set([
  'agent_message',
  'comment',
  'thinking',
  'warning',
  'error',
  'transport',
  'diagnostic',
  'run_status',
  'tool_call',
  'file_change',
  'todo_list',
  'subagent',
]);

function boundedString(value: unknown, maximum = 32 * 1024): value is string {
  return typeof value === 'string' && value.length <= maximum;
}

function isPresentationEvent(value: unknown): value is TaskExecutionPresentationEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  if (!boundedString(event.id, 256)
    || !boundedString(event.title, 4 * 1024)
    || !boundedString(event.status, 256)
    || !presentationKinds.has(String(event.kind ?? ''))
    || !['info', 'warning', 'error'].includes(String(event.severity ?? ''))) return false;
  if (event.kind === 'tool_call') return boundedString(event.command) && boundedString(event.exitCode, 256);
  if (event.kind === 'file_change') {
    return Array.isArray(event.files)
      && event.files.length <= 1_000
      && event.files.every((file) => {
        if (!file || typeof file !== 'object' || Array.isArray(file)) return false;
        const entry = file as Record<string, unknown>;
        return boundedString(entry.path, 4 * 1024) && boundedString(entry.action, 4 * 1024);
      });
  }
  if (event.kind === 'todo_list') {
    return Array.isArray(event.items)
      && event.items.length <= 1_000
      && event.items.every((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
        const entry = item as Record<string, unknown>;
        return boundedString(entry.text, 32 * 1024) && typeof entry.completed === 'boolean';
      });
  }
  if (event.kind === 'subagent') {
    return boundedString(event.skillName, 4 * 1024)
      && boundedString(event.model, 256)
      && boundedString(event.effort, 256);
  }
  return boundedString(event.text);
}

export function isTaskExecutionPresentationUpdate(value: unknown): value is TaskExecutionPresentationUpdate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const update = value as Record<string, unknown>;
  return typeof update.reset === 'boolean'
    && Array.isArray(update.events)
    && update.events.length <= 256
    && update.events.every(isPresentationEvent);
}

export function applyTaskExecutionPresentationUpdate(
  current: readonly TaskExecutionPresentationEvent[],
  update: TaskExecutionPresentationUpdate,
): TaskExecutionPresentationEvent[] {
  const merged = update.reset ? [] : [...current];
  const indexes = new Map(merged.map((event, index) => [event.id, index]));
  for (const event of update.events) {
    const index = indexes.get(event.id);
    if (index === undefined) {
      indexes.set(event.id, merged.length);
      merged.push(event);
    } else {
      merged[index] = event;
    }
  }
  return merged;
}

export function replicatedTaskExecutionPresentation(
  execution: ReplicatedTaskExecutionRecord,
  events: readonly TaskExecutionPresentationEvent[],
): TaskExecutionPresentation {
  const counts = {
    tools: events.filter((event) => event.kind === 'tool_call').length,
    messages: events.filter((event) => event.kind === 'agent_message').length,
    comments: events.filter((event) => event.kind === 'comment').length,
    thinking: events.filter((event) => event.kind === 'thinking').length,
    files: events.filter((event) => event.kind === 'file_change').length,
    warnings: events.filter((event) => event.kind === 'warning').length,
    errors: events.filter((event) => event.kind === 'error').length,
  };
  return {
    execution: {
      executionId: execution.metadata.executionId,
      sessionId: execution.metadata.sessionId,
      taskId: execution.metadata.taskId,
      kind: execution.metadata.kind,
      phase: execution.lifecycle.phase,
      requestedAt: execution.metadata.requestedAt,
      startedAt: execution.lifecycle.startedAt,
      finishedAt: execution.lifecycle.finishedAt,
      model: execution.metadata.model,
      effort: execution.metadata.effort,
      executorNodeId: execution.lifecycle.executorNodeId,
      revision: execution.lifecycle.revision,
      error: execution.lifecycle.error,
      counts,
    },
    events,
  };
}
