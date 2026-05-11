import { state } from '../state.js';
import { renderVoiceStatus } from './render-voice-status.js';

export function updateVoiceRecordingFrame(): void {
  if (!state.voice.recording) return;
  const analyser = state.voice.analyser as AnalyserNode | undefined;
  if (analyser) {
    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      const normalized = (sample - 128) / 128;
      sum += normalized * normalized;
    }
    state.voice.level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
  }
  state.voice.durationMs = Date.now() - state.voice.startedAt;
  renderVoiceStatus();
  state.voice.animationFrameId = requestAnimationFrame(updateVoiceRecordingFrame);
}
