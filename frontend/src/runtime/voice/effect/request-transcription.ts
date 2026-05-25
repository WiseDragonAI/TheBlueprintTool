/**
 * WHAT: Drives the voice transcription lifecycle from captured audio to draft text.
 * WHY: Stop-recording needs one controller-side path for upload, status, and draft fill.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderVoiceStatus } from './render-voice-status.js';
import { fillThreadDraft } from './fill-thread-draft.js';
import { uploadVoiceAudio } from './upload-voice-audio.js';

export async function requestTranscription(audio: Blob | null): Promise<void> {
  if (!audio || audio.size <= 0) {
    state.voice.transcriptionStatus = 'no audio captured';
    telemetry('request-transcription', { configured: false, reason: 'empty-audio' });
    renderVoiceStatus();
    return;
  }
  state.voice.transcriptionStatus = 'transcribing';
  telemetry('request-transcription', { configured: true, model: 'gpt-4o-mini-transcribe' });
  renderVoiceStatus();
  const result = await uploadVoiceAudio(audio);
  if (result.ok && result.text.trim()) {
    fillThreadDraft(result.text);
    state.voice.transcriptionStatus = 'transcribed';
  } else if (result.uploaded && !result.configured) {
    state.voice.voiceFileRef = result.voiceFileRef;
    state.voice.transcriptionStatus = 'voice uploaded; transcription not configured';
  } else {
    state.voice.transcriptionStatus = result.status === 503 ? 'transcription not configured' : `transcription failed${result.error ? `: ${result.error}` : ''}`;
  }
  telemetry('render-voice-status', { status: state.voice.transcriptionStatus, durationMs: state.voice.durationMs });
  renderVoiceStatus();
}
