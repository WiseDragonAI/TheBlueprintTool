/**
 * WHAT: Implements the transcribe-voice-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { parseHttpRequest } from '@backend/business/routing/helper/parse-http-request.js';
import { resolveTranscriptionConfig } from '@backend/business/transcription/helper/resolve-transcription-config.js';
import { callOpenaiTranscription } from '@backend/business/transcription/effect/call-openai-transcription.js';
import { persistUploadedVoiceAudio } from '@backend/business/transcription/effect/persist-uploaded-voice-audio.js';
import { clearUploadedVoiceAudio } from '@backend/business/transcription/effect/clear-uploaded-voice-audio.js';
import { persistTranscribedText } from '@backend/business/transcription/effect/persist-transcribed-text.js';
import { sendJsonResponse } from '@backend/business/routing/effect/send-json-response.js';

type AnyRecord = Record<string, unknown>;

export async function transcribeVoiceController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const request = parseHttpRequest({ action_payload: payload, runtime_state: runtime, data_model: data });
  const upload = persistUploadedVoiceAudio({ action_payload: payload, runtime_state: runtime, data_model: data });
  const config = resolveTranscriptionConfig({ action_payload: payload, runtime_state: runtime, data_model: data });
  let transcription: Record<string, unknown> = { ok: false, error: 'transcription not configured' };
  if (upload.ok !== false && config.ok !== false) {
    transcription = await callOpenaiTranscription({ action_payload: { ...payload, request, config }, runtime_state: runtime, data_model: data });
    if (transcription.ok !== false) {
      persistTranscribedText({ action_payload: { ...payload, request, config }, runtime_state: runtime, data_model: data });
      clearUploadedVoiceAudio({ action_payload: { voiceFileRef: upload.voiceFileRef }, runtime_state: runtime, data_model: data });
    }
  }
  const transcribed = config.ok !== false && transcription.ok !== false;
  const accepted = upload.ok !== false;
  const status = !accepted ? 400 : transcribed ? 200 : config.ok === false ? 202 : 502;
  const body = { ok: transcribed, uploaded: accepted, configured: config.ok !== false, voiceFileRef: transcribed ? '' : upload.voiceFileRef ?? '', text: runtime.transcriptionText ?? '', error: transcription.error };
  sendJsonResponse({ action_payload: { ...payload, status, body }, runtime_state: runtime, data_model: data });
  return { ...body, request, config };
}
