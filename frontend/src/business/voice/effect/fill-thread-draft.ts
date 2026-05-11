/**
 * WHAT: Implements the fill-thread-draft effect from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function fillThreadDraft(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
  telemetry('fill-thread-draft', { role: 'effect', action: 'fill-thread-draft' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  runtime.threadDraft = String(payload.transcription ?? payload.text ?? runtime.threadDraft ?? '');
}

