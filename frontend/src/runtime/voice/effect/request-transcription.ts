/**
 * WHAT: Drives the voice transcription lifecycle from captured audio to an optimistic ledger note.
 * WHY: Stop-recording needs one controller-side path for upload, transcription, failure, and retry state.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderVoiceStatus } from './render-voice-status.js';
import { uploadVoiceAudio } from './upload-voice-audio.js';
import { appendOptimisticThreadNote } from '../../thread/effect/append-optimistic-thread-note.js';
import { patchOptimisticThreadNote } from '../../thread/effect/patch-optimistic-thread-note.js';

export type VoiceTranscriptionRequest = {
  ledgerId?: string;
  threadId?: string;
  cardId?: string;
  queueCodex?: boolean;
};

function requestOptions(input: VoiceTranscriptionRequest | string | undefined): VoiceTranscriptionRequest {
  return typeof input === 'string' ? { threadId: input } : input ?? {};
}

export async function requestTranscription(audio: Blob | null, input: VoiceTranscriptionRequest | string = {}): Promise<void> {
  const options = requestOptions(input);
  const threadId = options.threadId || state.threadId || 'conversation-ledger';
  if (!state.threadId) state.threadId = threadId;
  if (!audio || audio.size <= 0) {
    state.voice.transcriptionStatus = 'no audio captured';
    appendOptimisticThreadNote({ threadId, body: 'Voice recording produced no audio.', status: 'capture failed', error: 'No audio captured' });
    telemetry('request-transcription', { configured: false, reason: 'empty-audio', threadId });
    renderVoiceStatus();
    return;
  }
  state.voice.transcriptionStatus = 'uploading voice';
  telemetry('request-transcription', { configured: true, model: 'gpt-4o-mini-transcribe', threadId, queueCodex: Boolean(options.queueCodex) });
  renderVoiceStatus();
  const noteId = appendOptimisticThreadNote({ threadId, body: 'Voice note captured. Uploading audio...', status: 'uploading', source: 'voice' });
  const upload = await uploadVoiceAudio(audio, {
    ledgerId: options.ledgerId || String(state.activeTab ?? ''),
    threadId,
    cardId: options.cardId ?? '',
    noteId,
    queueCodex: options.queueCodex
  });
  if (!upload.ok || !upload.voiceFileRef) {
    patchOptimisticThreadNote({ threadId, noteId, body: 'Voice upload failed before transcription.', status: 'upload failed', error: upload.error ?? '' });
    state.voice.transcriptionStatus = `voice upload failed${upload.error ? `: ${upload.error}` : ''}`;
    renderVoiceStatus();
    return;
  }
  state.voice.voiceFileRef = upload.voiceFileRef;
  state.voice.transcriptionStatus = 'transcribing';
  patchOptimisticThreadNote({ threadId, noteId, body: 'Voice uploaded.', voiceFileRef: upload.voiceFileRef, status: 'transcribing', error: '', transcriptionStartedAt: new Date().toISOString(), optimistic: false });
  telemetry('render-voice-status', { status: state.voice.transcriptionStatus, durationMs: state.voice.durationMs });
  renderVoiceStatus();
}
