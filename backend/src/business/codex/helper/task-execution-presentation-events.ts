/**
 * WHAT: Converts normalized run events into the lightweight execution presentation schema.
 * WHY: Event shaping, lifecycle coalescing, and payload exclusion form one reusable presentation boundary.
 */
import type {
  TaskExecutionFileEvent,
  TaskExecutionPresentationEvent,
  TaskExecutionTodoItem,
} from '../../../../../shared/schemas/task-execution-presentation-types.js';
import type { NormalizedRunEvent } from './card-skill-run-event-types.js';

type AnyRecord = Record<string, unknown>;

function todoItems(output: string): TaskExecutionTodoItem[] {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (!Array.isArray(parsed)) return [];
    // WHAT: Validate producer todo entries at the backend presentation boundary.
    // WHY: The overlay must never depend on parsing arbitrary JSON inside the browser.
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const value = entry as AnyRecord;
      const text = String(value.text ?? '').trim();
      return text ? [{ text, completed: value.completed === true }] : [];
    });
  } catch {
    // WHAT: Drop malformed todo payloads at the owning event boundary.
    // WHY: One invalid producer update must not make the complete execution log unreadable.
    return [];
  }
}

function fileItems(event: NormalizedRunEvent): TaskExecutionFileEvent['files'] {
  // WHAT: Preserve only relative path and action summaries emitted by the existing normalizer.
  // WHY: File contents and absolute artifact paths are not Codex Log presentation data.
  return (event.tool || event.text).split('\n').flatMap((line) => {
    const match = line.trim().match(/^-\s*(.+?):\s*(.+)$/);
    return match ? [{ path: match[1], action: match[2] }] : [];
  });
}

function presentationId(event: NormalizedRunEvent, index: number): string {
  // WHAT: Generate a stable logical identity without exposing physical line positions.
  // WHY: Full snapshot replacement needs DOM keys, not artifact cursors.
  return event.itemId ? `${event.kind}:${event.itemId}` : `${event.kind}:event-${index + 1}`;
}

function presentationEvent(event: NormalizedRunEvent, index: number): TaskExecutionPresentationEvent | null {
  const base = {
    id: presentationId(event, index),
    title: event.title,
    status: event.status,
    severity: event.severity,
  } as const;
  // WHAT: Convert todos to typed items and exclude their producer JSON string.
  // WHY: Todos render in a dedicated overlay without exposing raw tool output.
  if (event.kind === 'todo_list') {
    const items = todoItems(event.output);
    return items.length > 0 ? { ...base, kind: 'todo_list', items } : null;
  }
  // WHAT: Convert file changes to path-action summaries.
  // WHY: The log needs change identity without file bodies or artifact coordinates.
  if (event.kind === 'tool_call' && event.title === 'File changes') {
    return { ...base, kind: 'file_change', files: fileItems(event) };
  }
  // WHAT: Keep tool identity and settlement metadata while dropping result bodies.
  // WHY: Raw stdout, stderr, aggregated output, and duplicated fenced text caused the multi-megabyte response.
  if (event.kind === 'tool_call') {
    return {
      ...base,
      kind: 'tool_call',
      command: event.tool || event.title,
      exitCode: event.exitCode,
    };
  }
  const kind = ['agent_message', 'comment', 'thinking', 'warning', 'error', 'transport', 'diagnostic', 'run_status'].includes(event.kind)
    ? event.kind as 'agent_message' | 'comment' | 'thinking' | 'warning' | 'error' | 'transport' | 'diagnostic' | 'run_status'
    : 'diagnostic';
  return event.text ? { ...base, kind, text: event.text } : null;
}

export function taskExecutionPresentationEvents(events: NormalizedRunEvent[]): TaskExecutionPresentationEvent[] {
  const presented: TaskExecutionPresentationEvent[] = [];
  const lifecycleIndexes = new Map<string, number>();
  for (const [index, event] of events.entries()) {
    const item = presentationEvent(event, index);
    if (!item) continue;
    const lifecycleKey = event.itemId && (item.kind === 'tool_call' || item.kind === 'file_change' || item.kind === 'todo_list')
      ? `${item.kind}:${event.itemId}`
      : '';
    // WHAT: Replace lifecycle updates in their original chronological position.
    // WHY: Started, updated, and completed records describe one operator-visible tool or todo snapshot.
    const existingIndex = lifecycleKey ? lifecycleIndexes.get(lifecycleKey) : undefined;
    if (existingIndex !== undefined) presented[existingIndex] = item;
    else {
      if (lifecycleKey) lifecycleIndexes.set(lifecycleKey, presented.length);
      presented.push(item);
    }
  }
  return presented;
}
