/**
 * WHAT: Cancels an active recording without uploading it for transcription.
 * WHY: Esc must abort an in-progress voice note while a second Esc closes the panel.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderVoiceStatus } from '../effect/render-voice-status.js';

export function cancelVoiceRecording(): void {
  if (state.voice.animationFrameId) cancelAnimationFrame(state.voice.animationFrameId);
  const recorder = state.voice.recorder as MediaRecorder | undefined;
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  const stream = state.voice.stream as MediaStream | undefined;
  stream?.getTracks().forEach((track) => track.stop());
  const audioContext = state.voice.audioContext as AudioContext | undefined;
  void audioContext?.close();
  state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'recording canceled' };
  telemetry('cancel-voice-recording', { threadId: state.threadId });
  renderVoiceStatus();
}
