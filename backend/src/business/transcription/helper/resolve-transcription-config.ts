/**
 * WHAT: Implements the resolve-transcription-config helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;

export function resolveTranscriptionConfig(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('resolve-transcription-config', { role: 'helper', action: 'resolve-transcription-config' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const settings = (runtime.blueprinttoolSettings ?? {}) as AnyRecord;
  const apiKey = String(payload.openaiApiKey ?? process.env.OPENAI_API_KEY ?? runtime.openaiApiKey ?? settings.openaiApiKey ?? '');
  const model = String(payload.transcriptionModel ?? process.env.OPENAI_TRANSCRIPTION_MODEL ?? runtime.transcriptionModel ?? settings.transcriptionModel ?? 'gpt-4o-mini-transcribe');
  const transcriptionEnabled = payload.transcriptionEnabled ?? runtime.transcriptionEnabled ?? settings.transcriptionEnabled;
  const enabled = transcriptionEnabled !== false && (Boolean(apiKey) || Boolean(payload.transcriptionText) || payload.mode === 'dry-run');
  return { ok: enabled, enabled, apiKey, model, provider: 'openai' };
}
