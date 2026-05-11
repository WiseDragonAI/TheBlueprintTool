/**
 * WHAT: Implements the request-transcription effect from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function requestTranscription(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
  telemetry('request-transcription', { role: 'effect', action: 'request-transcription' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  runtime.transcriptionRequest = { requested: true, audioId: payload.audioId ?? 'inline-audio' };
}

