/**
 * WHAT: Implements the capture-voice-audio helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@frontend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function captureVoiceAudio(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('capture-voice-audio', { role: 'helper', action: 'capture-voice-audio' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const audio = payload.audio ?? payload.audioBlob ?? new Uint8Array();
  return { ok: payload.ok !== false, audio, durationMs: Number(payload.durationMs ?? 0), mimeType: String(payload.mimeType ?? 'audio/webm') };
}

