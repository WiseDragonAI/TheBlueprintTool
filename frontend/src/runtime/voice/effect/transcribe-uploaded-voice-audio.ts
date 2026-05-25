/**
 * WHAT: Requests provider transcription for an already preserved voice upload.
 * WHY: Upload and transcription are separate UI states and retry must reuse the same backend path.
 */
import { state } from '../../state.js';
import type { VoiceTranscriptionResult } from './upload-voice-audio.js';

export async function transcribeUploadedVoiceAudio(voiceFileRef: string): Promise<VoiceTranscriptionResult> {
  const response = await fetch('/api/transcribe/retry', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-thread-id': state.threadId || ''
    },
    body: JSON.stringify({ voiceFileRef, threadId: state.threadId || '' })
  }).catch((error) => ({ ok: false, status: 0, json: async () => ({ body: { ok: false, uploaded: true, voiceFileRef, error: error instanceof Error ? error.message : String(error) } }) }));
  const payload = await response.json().catch(() => ({}));
  const body = payload.body && typeof payload.body === 'object' ? payload.body : payload;
  return {
    ok: Boolean(response.ok && body.ok !== false),
    uploaded: Boolean(body.uploaded),
    configured: body.configured !== false,
    voiceFileRef: String(body.voiceFileRef ?? voiceFileRef),
    text: String(body.text ?? ''),
    error: body.error ? String(body.error) : undefined,
    status: response.status
  };
}
