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
  noteId?: string;
  voiceFileRef: string;
  text: string;
  error?: string;
  status?: number;
  queueCodex?: boolean;
};

export type VoiceUploadOptions = {
  ledgerId?: string;
  threadId?: string;
  cardId?: string;
  noteId?: string;
  queueCodex?: boolean;
};

function uploadOptions(input: VoiceUploadOptions | string | undefined): VoiceUploadOptions {
  return typeof input === 'string' ? { threadId: input } : input ?? {};
}

export async function uploadVoiceAudio(audio: Blob, input: VoiceUploadOptions | string = {}): Promise<VoiceTranscriptionResult> {
  const options = uploadOptions(input);
  const threadId = options.threadId || state.threadId || '';
  const form = new FormData();
  form.append('audio', audio, audio.type.includes('wav') ? 'voice.wav' : 'voice.webm');
  form.append('ledgerId', options.ledgerId || String(state.activeTab ?? ''));
  form.append('threadId', threadId);
  form.append('cardId', options.cardId ?? '');
  form.append('noteId', options.noteId ?? '');
  form.append('queueCodex', options.queueCodex ? 'true' : 'false');
  telemetry('upload-voice-audio', { optimistic: true, preserved: true, size: audio.size, type: audio.type, threadId, queueCodex: Boolean(options.queueCodex) });
  const response = await fetch('/api/voice-upload', {
    method: 'POST',
    body: form
  }).catch((error) => ({ ok: false, status: 0, json: async () => ({ body: { ok: false, error: error instanceof Error ? error.message : String(error) } }) }));
  const payload = await response.json().catch(() => ({}));
  const body = payload.body && typeof payload.body === 'object' ? payload.body : payload;
  const result: VoiceTranscriptionResult = {
    ok: Boolean(response.ok && body.ok !== false),
    uploaded: Boolean(body.uploaded),
    configured: body.configured !== false,
    voiceFileRef: String(body.voiceFileRef ?? ''),
    text: String(body.text ?? ''),
    error: body.error ? String(body.error) : undefined,
    status: response.status
  };
  if (body.noteId) result.noteId = String(body.noteId);
  if (body.queueCodex === true) result.queueCodex = true;
  return result;
}
