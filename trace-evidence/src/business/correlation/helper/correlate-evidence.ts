/**
 * WHAT: Projects explicit event identities and producer order into deterministic timelines.
 * WHY: Agents need readable flow evidence without timestamp-based causal inference.
 */
import type { RawTelemetryEvent } from '../../../lib/types.js';

function ordered(events: RawTelemetryEvent[]): RawTelemetryEvent[] {
  return [...events].sort((left, right) => left.sequence - right.sequence || left.eventId.localeCompare(right.eventId));
}

export function correlateEvidence(events: RawTelemetryEvent[]) {
  const group = (key: keyof Pick<RawTelemetryEvent, 'testId' | 'cardId' | 'executionId' | 'sessionId' | 'processId'>) => {
    const grouped = new Map<string, RawTelemetryEvent[]>();
    for (const event of events) {
      const identity = event[key];
      // WHAT: Leave missing identities for the uncorrelated inventory.
      // WHY: The projector must never manufacture a grouping key.
      if (identity === null || identity === '') continue;
      const bucket = grouped.get(String(identity)) ?? [];
      bucket.push(event); grouped.set(String(identity), bucket);
    }
    return Object.fromEntries([...grouped].map(([identity, bucket]) => [identity, ordered(bucket).map((event) => event.eventId)]));
  };
  return {
    ingestion: events.map((event, index) => ({ ingestionSequence: index + 1, eventId: event.eventId, sourceSequence: event.sequence })),
    tests: group('testId'), cards: group('cardId'), executions: group('executionId'), sessions: group('sessionId'), processes: group('processId'),
    uncorrelated: ordered(events.filter((event) => !event.testId && !event.cardId && !event.executionId && !event.sessionId)).map((event) => event.eventId),
    causalInference: false,
  };
}
