/**
 * WHAT: Implements the record-voice-controller controller from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { resolveVoiceSession } from '@frontend/business/voice/helper/resolve-voice-session.js';
import { captureVoiceAudio } from '@frontend/business/voice/helper/capture-voice-audio.js';
import { uploadVoiceAudio } from '@frontend/business/voice/effect/upload-voice-audio.js';
import { requestTranscription } from '@frontend/business/voice/effect/request-transcription.js';
import { fillThreadDraft } from '@frontend/business/voice/effect/fill-thread-draft.js';
import { renderVoiceStatus } from '@frontend/business/voice/effect/render-voice-status.js';

type AnyRecord = Record<string, unknown>;

export async function recordVoiceController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const session = resolveVoiceSession({ action_payload: payload, runtime_state: runtime, data_model: data });
  const audio = captureVoiceAudio({ action_payload: payload, runtime_state: runtime, data_model: data });
  if (session.ok !== false && audio.ok !== false) {
    uploadVoiceAudio({ action_payload: { ...payload, session, audio }, runtime_state: runtime, data_model: data });
    requestTranscription({ action_payload: { ...payload, session, audio }, runtime_state: runtime, data_model: data });
    fillThreadDraft({ action_payload: { ...payload, transcription: payload.transcription ?? '' }, runtime_state: runtime, data_model: data });
  }
  renderVoiceStatus({ action_payload: { ...payload, session, audio }, runtime_state: runtime, data_model: data });
  return { ok: session.ok !== false && audio.ok !== false, session, audio };
}

