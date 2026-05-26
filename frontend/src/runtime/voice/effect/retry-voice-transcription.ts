/**
 * WHAT: Retries transcription for a preserved voice upload attached to a ledger note.
 * WHY: Failed provider work must be recoverable without discarding the recorded audio.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderVoiceStatus } from './render-voice-status.js';
import { updateVoiceNote } from './update-voice-note.js';
import { transcribeUploadedVoiceAudio } from './transcribe-uploaded-voice-audio.js';

export async function retryVoiceTranscription(input: { noteId: string; voiceFileRef: string; threadId?: string }): Promise<void> {
  if (!input.noteId || !input.voiceFileRef) return;
  const threadId = input.threadId || state.threadId;
  state.voice.transcriptionStatus = 'retrying transcription';
  renderVoiceStatus();
  void updateVoiceNote({ threadId, noteId: input.noteId, voiceFileRef: input.voiceFileRef, status: 'transcribing', body: 'Voice uploaded.' });
  telemetry('retry-voice-transcription', { threadId, noteId: input.noteId });
  const result = await transcribeUploadedVoiceAudio(input.voiceFileRef, threadId);
  const voiceFileRef = result.voiceFileRef || input.voiceFileRef;
  if (result.ok && result.text.trim()) {
    void updateVoiceNote({ threadId, noteId: input.noteId, voiceFileRef, status: 'transcribed', body: result.text.trim(), error: '' });
    state.voice.voiceFileRef = voiceFileRef;
    state.voice.transcriptionStatus = 'transcribed';
  } else {
    const status = result.configured === false ? 'transcription not configured' : 'transcription failed';
    const error = result.error ?? status;
    void updateVoiceNote({ threadId, noteId: input.noteId, voiceFileRef, status, body: `Voice uploaded; ${status}.`, error });
    state.voice.voiceFileRef = voiceFileRef;
    state.voice.transcriptionStatus = `${status}${error && error !== status ? `: ${error}` : ''}`;
  }
  renderVoiceStatus();
}
