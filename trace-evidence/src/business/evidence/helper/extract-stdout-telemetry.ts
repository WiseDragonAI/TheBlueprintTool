/**
 * WHAT: Converts telemetry envelopes in captured stdout into the canonical run-scoped event contract.
 * WHY: Browser-compatible and generated harnesses cannot append directly to the trace worker's filesystem.
 */
import { randomUUID } from 'node:crypto';
import type { RawTelemetryEvent } from '../../../lib/types.js';

type AnyRecord = Record<string, unknown>;

export function extractStdoutTelemetry(input: { text: string; jobId: string; scopeId: string; testId: string; startSequence?: number }): RawTelemetryEvent[] {
  let sequence = input.startSequence ?? 0;
  return input.text.split('\n').flatMap((line) => {
    try {
      const envelope = JSON.parse(line) as AnyRecord;
      const trace = envelope.telemetry as AnyRecord | undefined;
      // WHAT: Ignore non-telemetry stdout records.
      // WHY: Test protocol and application logs share the same captured stream.
      if (!trace || typeof trace.name !== 'string') return [];
      return [{ schemaVersion: 1, traceJobId: input.jobId, traceRunId: input.jobId, scopeId: input.scopeId, testId: input.testId, cardId: null, executionId: null, sessionId: null, eventId: randomUUID(), sequence: sequence += 1, emittedAt: String(trace.at ?? new Date().toISOString()), monotonicNs: '', processId: 0, threadId: null, name: trace.name, phase: 'event' as const, args: trace.args ?? {}, rawStack: String(trace.rawStack ?? '') }];
    } catch { return []; }
  });
}
