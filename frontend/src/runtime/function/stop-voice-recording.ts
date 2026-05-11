import { state } from '../state.js';
import { renderVoiceStatus } from './render-voice-status.js';
import { telemetry } from './telemetry.js';

export function stopVoiceRecording(): void {
  if (state.voice.animationFrameId) cancelAnimationFrame(state.voice.animationFrameId);
  const recorder = state.voice.recorder as MediaRecorder | undefined;
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  const stream = state.voice.stream as MediaStream | undefined;
  stream?.getTracks().forEach((track) => track.stop());
  const audioContext = state.voice.audioContext as AudioContext | undefined;
  void audioContext?.close();
  state.voice.recording = false;
  state.voice.durationMs = state.voice.startedAt ? Date.now() - state.voice.startedAt : state.voice.durationMs;
  state.voice.level = 0;
  state.voice.transcriptionStatus = 'transcription unavailable';
  telemetry('upload-voice-audio', { optimistic: false, transient: true });
  telemetry('request-transcription', { configured: false });
  telemetry('render-voice-status', { status: state.voice.transcriptionStatus, durationMs: state.voice.durationMs });
  renderVoiceStatus();
}
