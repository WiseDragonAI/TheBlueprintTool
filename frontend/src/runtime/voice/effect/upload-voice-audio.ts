/**
 * WHAT: Uploads a transient voice audio blob to the backend transcription route.
 * WHY: Browser runtime must keep provider credentials behind the server boundary.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export type VoiceTranscriptionResult = {
  ok: boolean;
  uploaded: boolean;
  configured: boolean;
  voiceFileRef: string;
  text: string;
  error?: string;
  status?: number;
};

export async function uploadVoiceAudio(audio: Blob): Promise<VoiceTranscriptionResult> {
  telemetry('upload-voice-audio', { optimistic: true, transient: true, size: audio.size, type: audio.type });
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: {
      'content-type': audio.type || 'audio/webm',
      'x-thread-id': state.threadId || ''
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
