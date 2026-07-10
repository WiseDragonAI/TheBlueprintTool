/**
 * WHAT: Coalesces incremental Codex run events and groups adjacent tool lifecycles.
 * WHY: The thread log must remain chronological and replay-safe while polling JSONL and stderr.
 */
import type { CardSkillRunEvent } from '../effect/request-card-skill-run-status.js';
import {
  threadRunEventKey,
  threadRunEventRunId,
  threadRunEventSourceIdentity,
  threadRunToolKey,
} from './thread-run-event-identity.js';

export { groupSequentialToolCalls } from './group-sequential-tool-calls.js';
export { threadRunEventKey, threadRunToolKey } from './thread-run-event-identity.js';

export type ThreadRunLogEvent = CardSkillRunEvent & {
  eventKey: string;
  toolKey: string;
};

export type ThreadRunToolGroup = {
  kind: 'tool-group';
  key: string;
  runId: string;
  tools: ThreadRunLogEvent[];
};

export type ThreadRunEventBlock = {
  kind: 'event';
  key: string;
  event: ThreadRunLogEvent;
};

export type ThreadRunLogBlock = ThreadRunToolGroup | ThreadRunEventBlock;

export type ThreadRunMergeResult = {
  events: ThreadRunLogEvent[];
  tools: Record<string, ThreadRunLogEvent>;
  changedEventKeys: string[];
};

function normalizedLogEvent(event: CardSkillRunEvent, fallbackRunId: string): ThreadRunLogEvent {
  const runId = threadRunEventRunId(event, fallbackRunId);
  const normalized = { ...event, runId } as ThreadRunLogEvent;
  normalized.toolKey = threadRunToolKey(normalized, runId);
  normalized.eventKey = threadRunEventKey(normalized, runId);
  return normalized;
}

function eventFingerprint(event: ThreadRunLogEvent): string {
  return [
    event.eventKey,
    event.type,
    event.kind,
    event.title,
    event.text,
    event.status,
    event.tool,
    event.output,
    event.exitCode,
    event.severity,
  ].join('\u0000');
}

function terminalToolEvent(event: ThreadRunLogEvent): boolean {
  return /(?:completed|failed|cancelled|canceled)$/i.test(event.type)
    || /^(?:complete|completed|failed|cancelled|canceled)$/i.test(event.status);
}

export function mergeThreadRunEvents(
  previousEvents: ReadonlyArray<CardSkillRunEvent | ThreadRunLogEvent>,
  incrementalEvents: ReadonlyArray<CardSkillRunEvent>,
  fallbackRunId = ''
): ThreadRunMergeResult {
  const events = previousEvents.map((event) => normalizedLogEvent(event as CardSkillRunEvent, fallbackRunId));
  const indexByEventKey = new Map(events.map((event, index) => [event.eventKey, index]));
  const physicalLines = new Set(events.map((event) => `${event.runId}:${threadRunEventSourceIdentity(event)}`));
  const changedEventKeys: string[] = [];

  for (const input of incrementalEvents) {
    const incoming = normalizedLogEvent(input, fallbackRunId);
    const physicalKey = `${incoming.runId}:${threadRunEventSourceIdentity(incoming)}`;
    const existingIndex = indexByEventKey.get(incoming.eventKey);
    // WHAT: Append a previously unseen logical event unless its source line was already consumed.
    // WHY: Missing item ids can change logical keys, but one physical producer line must render once.
    if (existingIndex === undefined) {
      // WHAT: Ignore replayed physical lines that arrived under a different fallback identity.
      // WHY: Cursor retries must not duplicate chronological output.
      if (physicalLines.has(physicalKey)) continue;
      indexByEventKey.set(incoming.eventKey, events.length);
      physicalLines.add(physicalKey);
      events.push(incoming);
      changedEventKeys.push(incoming.eventKey);
      continue;
    }

    const existing = events[existingIndex];
    // WHAT: Update only active tool lifecycles and reject regressions from terminal states.
    // WHY: Non-tool events are immutable observations and late start records must not overwrite completion.
    if (!incoming.toolKey || (terminalToolEvent(existing) && !terminalToolEvent(incoming))) continue;
    const updated: ThreadRunLogEvent = {
      ...existing,
      ...incoming,
      itemId: incoming.itemId || existing.itemId,
      tool: incoming.tool || existing.tool,
      title: incoming.title || existing.title,
      line: existing.line,
      source: existing.source,
      sourceLine: existing.sourceLine,
      eventKey: existing.eventKey,
      toolKey: existing.toolKey,
    };
    // WHAT: Skip byte-equivalent lifecycle replays.
    // WHY: Consumers announce only material event changes.
    if (eventFingerprint(updated) === eventFingerprint(existing)) continue;
    events[existingIndex] = updated;
    physicalLines.add(physicalKey);
    changedEventKeys.push(existing.eventKey);
  }

  const tools: Record<string, ThreadRunLogEvent> = {};
  for (const event of events) {
    // WHAT: Index only coalesced tool events for disclosure consumers.
    // WHY: Ordinary log events do not have tool lifecycle identity.
    if (event.toolKey) tools[event.toolKey] = event;
  }
  return { events, tools, changedEventKeys };
}
