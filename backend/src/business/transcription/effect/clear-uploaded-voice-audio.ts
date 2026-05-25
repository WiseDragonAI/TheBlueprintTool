/**
 * WHAT: Removes a transient voice upload after a transcript has been produced.
 * WHY: Completed voice notes persist as text, not durable cached audio files.
 */
import { existsSync, unlinkSync } from 'node:fs';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function clearUploadedVoiceAudio(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('clear-uploaded-voice-audio', { role: 'effect', action: 'clear-uploaded-voice-audio' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const voiceFileRef = String(payload.voiceFileRef ?? runtime.voiceFileRef ?? '');
  if (voiceFileRef && existsSync(voiceFileRef)) unlinkSync(voiceFileRef);
  runtime.voiceFileRef = '';
  runtime.voiceUploadStatus = 'cleared';
  return { ok: true, voiceFileRef };
}
