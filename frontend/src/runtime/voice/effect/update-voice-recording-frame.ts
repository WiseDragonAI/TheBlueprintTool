import { state } from '../../state.js';
import { renderVoiceStatus } from './render-voice-status.js';
import { calculateVoiceLevel } from '../helper/calculate-voice-level.js';
import { interpolateVoiceLevel, voiceValueFrameMs } from '../helper/interpolate-voice-level.js';
import { normalizeVoiceLevels } from '../helper/normalize-voice-levels.js';

export function updateVoiceRecordingFrame(): void {
  if (!state.voice.recording) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const analyser = state.voice.analyser as AnalyserNode | undefined;
  if (analyser) {
    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    state.voice.level = calculateVoiceLevel(samples, { midpoint: 128, scale: 128 });
    state.voice.pendingVoicePeak = Math.max(Number(state.voice.pendingVoicePeak ?? 0), Number(state.voice.level ?? 0));
  }
  state.voice.durationMs = Date.now() - state.voice.startedAt;
  const lastValueFrameAt = Number(state.voice.lastValueFrameAt ?? 0);
  if (!lastValueFrameAt || now - lastValueFrameAt >= voiceValueFrameMs) {
    const waveSamples = Array.isArray(state.voice.waveSamples) ? state.voice.waveSamples : [];
    const bucketPeak = Math.max(Number(state.voice.pendingVoicePeak ?? 0), Number(state.voice.level ?? 0));
    waveSamples.push(bucketPeak);
    state.voice.waveSamples = waveSamples;
    state.voice.pendingVoicePeak = 0;
    state.voice.lastValueFrameAt = now;
    const previousDisplayLevel = interpolateVoiceLevel({
      from: state.voice.displayLevelFrom,
      to: state.voice.displayLevelTo,
      startedAt: state.voice.displayLevelStartedAt,
      now
    });
    const normalized = normalizeVoiceLevels(waveSamples, bucketPeak);
    state.voice.displayLevelFrom = previousDisplayLevel;
    state.voice.displayLevelTo = normalized.level;
    state.voice.displayLevelStartedAt = now;
  }
  renderVoiceStatus();
  state.voice.animationFrameId = requestAnimationFrame(updateVoiceRecordingFrame);
}
