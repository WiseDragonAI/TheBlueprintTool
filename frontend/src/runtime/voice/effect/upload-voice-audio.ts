/**
 * WHAT: Uploads a voice audio blob to the backend local upload cache.
 * WHY: Audio must be preserved before provider transcription can succeed or fail.
 */
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { state } from '../../state.js';

export type VoiceTranscriptionResult = {
  ok: boolean;
  uploaded: boolean;
  configured: boolean;
  voiceFileRef: string;
  text: string;
  error?: string;
  status?: number;
};

export async function uploadVoiceAudio(audio: Blob, threadId = state.threadId || ''): Promise<VoiceTranscriptionResult> {
  telemetry('upload-voice-audio', { optimistic: true, preserved: true, size: audio.size, type: audio.type, threadId });
  const response = await fetch('/api/voice-upload', {
    method: 'POST',
    headers: {
      'content-type': audio.type || 'audio/webm',
      'x-thread-id': threadId
    },
    body: audio
  }).catch((error) => ({ ok: false, status: 0, json: async () => ({ body: { ok: false, error: error instanceof Error ? error.message : String(error) } }) }));
  const payload = await response.json().catch(() => ({}));
  const body = payload.body && typeof payload.body === 'object' ? payload.body : payload;
  return {
    ok: Boolean(response.ok && body.ok !== false),
    uploaded: Boolean(body.uploaded),
    configured: body.configured !== false,
    voiceFileRef: String(body.voiceFileRef ?? ''),
    text: String(body.text ?? ''),
    error: body.error ? String(body.error) : undefined,
    status: response.status
  };
}
