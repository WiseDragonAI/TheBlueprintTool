/**
 * WHAT: Groups adjacent tool-call events without disturbing chronological non-tool events.
 * WHY: Codex Log needs compact tool disclosures while preserving the source event sequence.
 */
import type { ThreadRunLogBlock, ThreadRunLogEvent } from './thread-run-log.js';

export function groupSequentialToolCalls(events: ReadonlyArray<ThreadRunLogEvent>): ThreadRunLogBlock[] {
  const blocks: ThreadRunLogBlock[] = [];
  for (const event of events) {
    const previous = blocks.at(-1);
    // WHAT: Coalesce only adjacent tools from the same run.
    // WHY: Status, message, and diagnostic events are chronological group boundaries.
    if (event.kind === 'tool_call') {
      // WHAT: Extend the active group when its run identity matches.
      // WHY: A single disclosure should represent one uninterrupted tool sequence.
      if (previous?.kind === 'tool-group' && previous.runId === event.runId) {
        previous.tools.push(event);
      } else {
        // WHAT: Start a stable group at the first tool's chronological position.
        // WHY: Disclosure identity must survive incremental lifecycle updates.
        blocks.push({ kind: 'tool-group', key: `${event.runId}:tool-group:${event.eventKey}`, runId: event.runId, tools: [event] });
      }
      continue;
    }
    blocks.push({ kind: 'event', key: event.eventKey, event });
  }
  return blocks;
}
