/**
 * WHAT: Coalesces incremental Codex run events and groups adjacent tool lifecycles.
 * WHY: The thread log must remain chronological and replay-safe while polling JSONL and stderr.
 */
import type { CardSkillRunEvent } from '../effect/request-card-skill-run-status.js';

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

function eventRunId(event: Partial<CardSkillRunEvent>, fallbackRunId: string): string {
  return String(event.runId ?? fallbackRunId).trim();
}

function sourceIdentity(event: Partial<CardSkillRunEvent>): string {
  const source = event.source === 'stderr' ? 'stderr' : 'jsonl';
  const sourceLine = Math.max(0, Number(event.sourceLine ?? event.line ?? 0) || 0);
  return `${source}:${sourceLine}`;
}

export function threadRunToolKey(event: Partial<CardSkillRunEvent>, fallbackRunId = ''): string {
  if (String(event.kind ?? '') !== 'tool_call') return '';
  const runId = eventRunId(event, fallbackRunId);
  const itemId = String(event.itemId ?? '').trim();
  return itemId ? `${runId}:item:${itemId}` : `${runId}:line:${sourceIdentity(event)}`;
}

export function threadRunEventKey(event: Partial<CardSkillRunEvent>, fallbackRunId = ''): string {
  const runId = eventRunId(event, fallbackRunId);
  const toolKey = threadRunToolKey(event, fallbackRunId);
  return toolKey || `${runId}:event:${sourceIdentity(event)}`;
}

function normalizedLogEvent(event: CardSkillRunEvent, fallbackRunId: string): ThreadRunLogEvent {
  const runId = eventRunId(event, fallbackRunId);
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
  const physicalLines = new Set(events.map((event) => `${event.runId}:${sourceIdentity(event)}`));
  const changedEventKeys: string[] = [];

  for (const input of incrementalEvents) {
    const incoming = normalizedLogEvent(input, fallbackRunId);
    const physicalKey = `${incoming.runId}:${sourceIdentity(incoming)}`;
    const existingIndex = indexByEventKey.get(incoming.eventKey);
    if (existingIndex === undefined) {
      if (physicalLines.has(physicalKey)) continue;
      indexByEventKey.set(incoming.eventKey, events.length);
      physicalLines.add(physicalKey);
      events.push(incoming);
      changedEventKeys.push(incoming.eventKey);
      continue;
    }

    const existing = events[existingIndex];
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
    if (eventFingerprint(updated) === eventFingerprint(existing)) continue;
    events[existingIndex] = updated;
    physicalLines.add(physicalKey);
    changedEventKeys.push(existing.eventKey);
  }

  const tools: Record<string, ThreadRunLogEvent> = {};
  for (const event of events) {
    if (event.toolKey) tools[event.toolKey] = event;
  }
  return { events, tools, changedEventKeys };
}

export function groupSequentialToolCalls(events: ReadonlyArray<ThreadRunLogEvent>): ThreadRunLogBlock[] {
  const blocks: ThreadRunLogBlock[] = [];
  for (const event of events) {
    const previous = blocks.at(-1);
    if (event.kind === 'tool_call') {
      if (previous?.kind === 'tool-group' && previous.runId === event.runId) {
        previous.tools.push(event);
      } else {
        blocks.push({ kind: 'tool-group', key: `${event.runId}:tool-group:${event.eventKey}`, runId: event.runId, tools: [event] });
      }
      continue;
    }
    blocks.push({ kind: 'event', key: event.eventKey, event });
  }
  return blocks;
}
