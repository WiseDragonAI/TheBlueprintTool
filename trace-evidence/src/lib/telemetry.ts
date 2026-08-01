/**
 * WHAT: Emits trace-tool control telemetry without allowing diagnostics to affect control flow.
 * WHY: The trace tool must be able to capture its own execution evidence safely.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RawTelemetryEvent } from './types.js';

let sequence = 0;

export function telemetry(name: string, args: unknown = {}, phase: RawTelemetryEvent['phase'] = 'event'): void {
  const file = process.env.TRACE_EVIDENCE_TELEMETRY_FILE;
  // WHAT: Avoid stack and filesystem work when no trace job activated collection.
  // WHY: Normal tool and application execution must retain its lightweight telemetry cost.
  if (!file) return;
  try {
    const error = new Error();
    Error.captureStackTrace(error, telemetry);
    const event: RawTelemetryEvent = {
      schemaVersion: 1,
      traceJobId: process.env.TRACE_EVIDENCE_JOB_ID ?? '',
      traceRunId: process.env.TRACE_EVIDENCE_RUN_ID ?? '',
      scopeId: process.env.TRACE_EVIDENCE_SCOPE_ID ?? '',
      testId: process.env.TRACE_EVIDENCE_TEST_ID ?? null,
      cardId: process.env.TRACE_EVIDENCE_CARD_ID ?? null,
      executionId: process.env.TRACE_EVIDENCE_EXECUTION_ID ?? null,
      sessionId: process.env.TRACE_EVIDENCE_SESSION_ID ?? null,
      eventId: randomUUID(), sequence: sequence += 1,
      emittedAt: new Date().toISOString(), monotonicNs: process.hrtime.bigint().toString(),
      processId: process.pid, threadId: null, name, phase, args, rawStack: error.stack ?? '',
    };
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(event)}\n`, 'utf8');
  } catch (error) {
    const failureFile = process.env.TRACE_EVIDENCE_FAILURE_FILE;
    // WHAT: Record a contained telemetry writer failure through an independent run-scoped lane.
    // WHY: Diagnostics must remain observable without throwing into application control flow.
    if (failureFile) {
      try { mkdirSync(dirname(failureFile), { recursive: true }); appendFileSync(failureFile, `${JSON.stringify({ type: 'collection-failure', component: 'telemetry-writer', scopeId: process.env.TRACE_EVIDENCE_SCOPE_ID ?? '', code: 'telemetry_write_failed', message: error instanceof Error ? error.message : String(error), at: new Date().toISOString() })}\n`, 'utf8'); } catch { /* The secondary diagnostic boundary is also failsafe. */ }
    }
  }
}
