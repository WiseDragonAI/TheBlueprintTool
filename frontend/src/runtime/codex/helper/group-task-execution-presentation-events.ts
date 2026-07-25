/**
 * WHAT: Groups adjacent lightweight tool events without disturbing chronological message boundaries.
 * WHY: Backend lifecycle coalescing merges updates for one tool, while the UI still needs compact groups of consecutive tools.
 */
import type {
  TaskExecutionPresentationEvent,
  TaskExecutionToolEvent,
} from '../../../../../shared/schemas/task-execution-presentation-types.js';

export type TaskExecutionPresentationBlock =
  | { readonly kind: 'tool-group'; readonly id: string; readonly tools: TaskExecutionToolEvent[] }
  | { readonly kind: 'event'; readonly id: string; readonly event: TaskExecutionPresentationEvent };

export function groupTaskExecutionPresentationEvents(
  events: readonly TaskExecutionPresentationEvent[],
): TaskExecutionPresentationBlock[] {
  const blocks: TaskExecutionPresentationBlock[] = [];
  for (const event of events) {
    const previous = blocks.at(-1);
    if (event.kind === 'tool_call') {
      // WHAT: Extend only the immediately preceding tool group.
      // WHY: Messages, comments, todos, and diagnostics remain chronological group boundaries.
      if (previous?.kind === 'tool-group') {
        previous.tools.push(event);
      } else {
        blocks.push({ kind: 'tool-group', id: `tool-group:${event.id}`, tools: [event] });
      }
      continue;
    }
    blocks.push({ kind: 'event', id: event.id, event });
  }
  return blocks;
}
