/**
 * WHAT: Converts normalized run events into the lightweight execution presentation schema.
 * WHY: Event shaping, lifecycle coalescing, and payload exclusion form one reusable presentation boundary.
 */
import { createHash } from 'node:crypto';
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

function presentationId(event: NormalizedRunEvent): string {
  // WHAT: Generate a stable logical identity without exposing physical line positions.
  // WHY: Full snapshots and incremental batches must merge to the same DOM key.
  if (event.itemId) return `${event.kind}:${event.itemId}`;
  const digest = createHash('sha256').update(`${event.kind}\0${event.line}`).digest('hex').slice(0, 16);
  return `${event.kind}:event-${digest}`;
}

function commandFlag(command: string, name: string): string {
  const match = command.match(new RegExp(`(?:^|\\s)--${name}\\s+(?:'([^']*)'|"([^"]*)"|([^\\s'"]+))`));
  return String(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function queuedSubagent(event: NormalizedRunEvent): TaskExecutionPresentationEvent | null {
  if (event.kind !== 'tool_call' || !/\bledger-cli\s+queue-skill\b/.test(event.tool)) return null;
  const skillName = commandFlag(event.tool, 'skill');
  if (!skillName) return null;
  return {
    id: `subagent:${event.itemId || presentationId(event)}`,
    kind: 'subagent',
    title: `Subagent · ${skillName}`,
    status: event.status,
    severity: event.severity,
    skillName,
    model: commandFlag(event.tool, 'model'),
    effort: commandFlag(event.tool, 'effort'),
  };
}

function presentationEvent(event: NormalizedRunEvent): TaskExecutionPresentationEvent | null {
  const base = {
    id: presentationId(event),
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
  let userPrompt = '';
  let startPresented = false;
  for (const event of events) {
    if (event.type === 'decision_os.user_prompt' || event.type === 'decision_os.developer_prompt') {
      userPrompt = event.text;
      const prompt = presentationEvent({
        ...event,
        kind: 'run_status',
        title: 'User prompt',
        status: 'running',
        itemId: 'user-prompt',
      });
      if (prompt) presented.push(prompt);
      continue;
    }
    const start = event.type === 'thread.started' || event.type === 'turn.started';
    if (start && (userPrompt || startPresented)) continue;
    if (start) startPresented = true;
    const presentedEvent = event;
    // WHAT: Add a typed subagent card beside the underlying tool call.
    // WHY: The inventory needs the launch contract while tool counts must continue to include the real CLI invocation.
    const items = [queuedSubagent(presentedEvent), presentationEvent(presentedEvent)]
      .filter((item): item is TaskExecutionPresentationEvent => Boolean(item));
    for (const item of items) {
      const lifecycleKey = event.itemId && (item.kind === 'tool_call' || item.kind === 'file_change' || item.kind === 'todo_list' || item.kind === 'subagent')
        ? `${item.kind}:${event.itemId}`
        : '';
      // WHAT: Replace lifecycle updates in their original chronological position.
      // WHY: Started, updated, and completed records describe one operator-visible tool, subagent, or todo snapshot.
      const existingIndex = lifecycleKey ? lifecycleIndexes.get(lifecycleKey) : undefined;
      if (existingIndex !== undefined) presented[existingIndex] = item;
      else {
        if (lifecycleKey) lifecycleIndexes.set(lifecycleKey, presented.length);
        presented.push(item);
      }
    }
  }
  return presented;
}
