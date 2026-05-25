/**
 * WHAT: Implements the transcribe-voice-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { parseHttpRequest } from '@backend/business/routing/helper/parse-http-request.js';
import { resolveTranscriptionConfig } from '@backend/business/transcription/helper/resolve-transcription-config.js';
import { callOpenaiTranscription } from '@backend/business/transcription/effect/call-openai-transcription.js';
import { persistTranscribedText } from '@backend/business/transcription/effect/persist-transcribed-text.js';
import { sendJsonResponse } from '@backend/business/routing/effect/send-json-response.js';

type AnyRecord = Record<string, unknown>;

export async function transcribeVoiceController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const request = parseHttpRequest({ action_payload: payload, runtime_state: runtime, data_model: data });
  const config = resolveTranscriptionConfig({ action_payload: payload, runtime_state: runtime, data_model: data });
  let transcription: Record<string, unknown> = { ok: false, error: 'transcription not configured' };
  if (config.ok !== false) {
    transcription = await callOpenaiTranscription({ action_payload: { ...payload, request, config }, runtime_state: runtime, data_model: data });
    if (transcription.ok !== false) persistTranscribedText({ action_payload: { ...payload, request, config }, runtime_state: runtime, data_model: data });
  }
  const ok = config.ok !== false && transcription.ok !== false;
  sendJsonResponse({ action_payload: { ...payload, status: config.ok === false ? 503 : ok ? 200 : 502, body: { ok, text: runtime.transcriptionText ?? '', error: transcription.error } }, runtime_state: runtime, data_model: data });
  return { ok, request, config, text: runtime.transcriptionText ?? '', error: transcription.error };
}
