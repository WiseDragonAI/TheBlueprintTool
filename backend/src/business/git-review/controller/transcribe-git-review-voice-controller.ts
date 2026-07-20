/**
 * WHAT: Persists and transcribes one Git-widget recording without creating a thread note.
 * WHY: Code-review audio belongs to the card widget and must never mutate the global thread voice lifecycle.
 */
import { randomUUID } from 'node:crypto';
import { callOpenaiTranscription } from '../../transcription/effect/call-openai-transcription.js';
import { persistUploadedVoiceAudio } from '../../transcription/effect/persist-uploaded-voice-audio.js';
import { resolveTranscriptionConfig } from '../../transcription/helper/resolve-transcription-config.js';
import type { GitReviewNote } from '../../../../../shared/schemas/git-review-types.js';

type AnyRecord = Record<string, unknown>;
const transcriptionDeadlineMs = 120_000;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function transcribeGitReviewVoiceController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const data = (envelope.data_model ?? {}) as AnyRecord;
  const audioBuffer = payload.audioBuffer as Buffer | undefined;
  if (!audioBuffer?.byteLength) return { ok: false, statusCode: 400, error: 'No Git review audio was uploaded.' };

  const upload = persistUploadedVoiceAudio({
    action_payload: { ...payload, audioBuffer, mimeType: text(payload.mimeType) || 'audio/webm' },
    runtime_state: runtime,
    data_model: data,
  });
  if (upload.ok === false || !upload.voiceFileRef) return { ok: false, statusCode: 400, error: upload.error ?? 'Git review audio could not be saved.' };

  const config = resolveTranscriptionConfig({ action_payload: payload, runtime_state: runtime, data_model: data });
  let transcription: AnyRecord = { ok: false, error: String(config.error ?? 'OpenAI transcription is not configured') };
  if (config.ok !== false) {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), transcriptionDeadlineMs);
    transcription = await callOpenaiTranscription({
      action_payload: { ...payload, config, audioBuffer, mimeType: text(payload.mimeType) || 'audio/webm', signal: controller.signal },
      runtime_state: runtime,
      data_model: data,
    }).catch((error) => ({ ok: false, error: controller.signal.aborted ? `Transcription timed out after ${transcriptionDeadlineMs}ms.` : error instanceof Error ? error.message : String(error) }));
    clearTimeout(deadline);
  }

  const transcript = text(runtime.transcriptionText ?? transcription.text);
  const failed = transcription.ok === false || !transcript;
  const note: GitReviewNote = {
    id: text(payload.noteId) || `git-review-note-${Date.now()}-${randomUUID().slice(0, 8)}`,
    repository: text(payload.repository),
    target: text(payload.target),
    file: text(payload.file),
    hunk: text(payload.hunk),
    patchHash: text(payload.patchHash),
    ...(text(payload.selection) ? { selection: text(payload.selection) } : {}),
    body: failed ? 'Voice review could not be transcribed.' : transcript,
    voiceFileRef: String(upload.voiceFileRef),
    status: failed ? 'transcription failed' : 'transcribed',
    ...(failed ? { error: text(transcription.error) || 'Transcription returned no text.' } : {}),
    createdAt: new Date().toISOString(),
  };
  return { ok: true, statusCode: 200, note };
}
