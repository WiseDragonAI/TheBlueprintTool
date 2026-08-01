/**
 * WHAT: Parses telemetry JSONL while retaining exact byte offsets for every rejected record.
 * WHY: Normalized event views must never erase malformed raw evidence.
 */
import type { RawTelemetryEvent, TraceParseFailure } from '../../../lib/types.js';

export function parseTelemetryJsonl(input: { artifact: string; text: string }): { events: RawTelemetryEvent[]; failures: TraceParseFailure[] } {
  const events: RawTelemetryEvent[] = [];
  const failures: TraceParseFailure[] = [];
  let byteOffset = 0;
  const lines = input.text.split('\n');
  for (const [index, line] of lines.entries()) {
    const bytes = Buffer.byteLength(line) + 1;
    // WHAT: Ignore only the conventional terminal empty JSONL line.
    // WHY: It carries no admitted record and therefore is not a parse failure.
    if (!line && index === lines.length - 1) { byteOffset += bytes; continue; }
    try {
      const event = JSON.parse(line) as Partial<RawTelemetryEvent>;
      // WHAT: Reject normalized telemetry without its stable identity and emission-time stack.
      // WHY: Such records remain raw evidence but cannot enter correlated event views.
      if (event.schemaVersion !== 1 || !event.eventId || !event.scopeId || typeof event.rawStack !== 'string' || event.rawStack.length === 0) throw new Error('required telemetry identity or rawStack is missing');
      events.push(event as RawTelemetryEvent);
    } catch (error) {
      failures.push({ artifact: input.artifact, line: index + 1, byteOffset, code: line.startsWith('{') ? 'invalid_telemetry_event' : 'malformed_jsonl', message: error instanceof Error ? error.message : String(error) });
    }
    byteOffset += bytes;
  }
  return { events, failures };
}
