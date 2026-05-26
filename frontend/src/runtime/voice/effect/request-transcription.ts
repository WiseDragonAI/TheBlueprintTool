/**
 * WHAT: Drives the voice transcription lifecycle from captured audio to an optimistic ledger note.
 * WHY: Stop-recording needs one controller-side path for upload, transcription, failure, and retry state.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderVoiceStatus } from './render-voice-status.js';
import { uploadVoiceAudio } from './upload-voice-audio.js';
import { appendVoiceNote } from './append-voice-note.js';
import { updateVoiceNote } from './update-voice-note.js';
import { transcribeUploadedVoiceAudio } from './transcribe-uploaded-voice-audio.js';

export async function requestTranscription(audio: Blob | null, threadId = state.threadId || 'conversation-ledger'): Promise<void> {
  if (!state.threadId) state.threadId = threadId;
  if (!audio || audio.size <= 0) {
    state.voice.transcriptionStatus = 'no audio captured';
    appendVoiceNote({ threadId, body: 'Voice recording produced no audio.', status: 'capture failed', error: 'No audio captured' });
    telemetry('request-transcription', { configured: false, reason: 'empty-audio', threadId });
    renderVoiceStatus();
    return;
  }
  state.voice.transcriptionStatus = 'uploading voice';
  telemetry('request-transcription', { configured: true, model: 'gpt-4o-mini-transcribe', threadId });
  renderVoiceStatus();
  const note = appendVoiceNote({ threadId, body: 'Voice note captured. Uploading audio...', status: 'uploading' });
  if (!note.ok) {
    state.voice.transcriptionStatus = 'voice note commit failed';
    renderVoiceStatus();
    return;
  }
  const upload = await uploadVoiceAudio(audio, threadId);
  if (!upload.ok || !upload.voiceFileRef) {
    void updateVoiceNote({ threadId, noteId: note.noteId, body: 'Voice upload failed before transcription.', status: 'upload failed', error: upload.error ?? '' });
    state.voice.transcriptionStatus = `voice upload failed${upload.error ? `: ${upload.error}` : ''}`;
    renderVoiceStatus();
    return;
  }
  state.voice.voiceFileRef = upload.voiceFileRef;
  state.voice.transcriptionStatus = 'transcribing';
  void updateVoiceNote({ threadId, noteId: note.noteId, body: 'Voice uploaded.', voiceFileRef: upload.voiceFileRef, status: 'transcribing', error: '' });
  renderVoiceStatus();
  const result = await transcribeUploadedVoiceAudio(upload.voiceFileRef, threadId);
  if (result.ok && result.text.trim()) {
    state.voice.voiceFileRef = result.voiceFileRef;
    void updateVoiceNote({ threadId, noteId: note.noteId, body: result.text.trim(), voiceFileRef: result.voiceFileRef, status: 'transcribed', error: '' });
    state.voice.transcriptionStatus = 'transcribed';
  } else if (result.uploaded && !result.configured) {
    state.voice.voiceFileRef = result.voiceFileRef;
    void updateVoiceNote({ threadId, noteId: note.noteId, body: 'Voice uploaded; transcription not configured.', voiceFileRef: result.voiceFileRef, status: 'transcription not configured', error: result.error ?? '' });
    state.voice.transcriptionStatus = 'voice uploaded; transcription not configured';
  } else if (result.uploaded) {
    state.voice.voiceFileRef = result.voiceFileRef;
    void updateVoiceNote({ threadId, noteId: note.noteId, body: 'Voice uploaded; transcription failed.', voiceFileRef: result.voiceFileRef, status: 'transcription failed', error: result.error ?? '' });
    state.voice.transcriptionStatus = `transcription failed${result.error ? `: ${result.error}` : ''}`;
  } else {
    void updateVoiceNote({ threadId, noteId: note.noteId, body: 'Voice uploaded; transcription failed.', voiceFileRef: upload.voiceFileRef, status: 'transcription failed', error: result.error ?? '' });
    state.voice.transcriptionStatus = `transcription failed${result.error ? `: ${result.error}` : ''}`;
  }
  telemetry('render-voice-status', { status: state.voice.transcriptionStatus, durationMs: state.voice.durationMs });
  renderVoiceStatus();
}
