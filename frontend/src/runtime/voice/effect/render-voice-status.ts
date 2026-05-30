/**
 * WHAT: Reflects the current voice recording status into the thread footer.
 * WHY: Recording owns the waveform dock, while upload/transcription progress belongs to the optimistic note state.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { interpolateVoiceLevel } from '../helper/interpolate-voice-level.js';
import { formatVoiceDuration } from '../helper/format-voice-duration.js';
import { normalizeVoiceLevels } from '../helper/normalize-voice-levels.js';
import { paintVoiceWaveLevel } from './paint-voice-wave-level.js';

export function renderVoiceStatus(): void {
  const status = document.querySelector('.voice-status') as HTMLElement | null;
  const meter = (document.querySelector('.meter-fill') ?? document.querySelector('.voice-meter-value')) as HTMLElement | null;
  const timer = document.querySelector('.wave-timer') as HTMLElement | null;
  const panel = document.querySelector('.voice-panel') as HTMLElement | null;
  const recorder = document.querySelector('.voice-recorder') as HTMLElement | null;
  if (!status || !meter || !panel) return;
  const seconds = (Number(state.voice.durationMs ?? 0) / 1000).toFixed(1);
  const level = Math.max(0, Math.min(1, Number(state.voice.level ?? 0)));
  const waveSamples = Array.isArray(state.voice.waveSamples) ? state.voice.waveSamples : [];
  const normalized = normalizeVoiceLevels(waveSamples, level);
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const displayLevel = state.voice.recording
    ? interpolateVoiceLevel({
      from: state.voice.displayLevelFrom,
      to: state.voice.displayLevelTo ?? normalized.level,
      startedAt: state.voice.displayLevelStartedAt,
      now
    })
    : level;
  const busy = /transcribing|uploading|retrying/.test(String(state.voice.transcriptionStatus ?? ''));
  panel.classList.toggle('recording', Boolean(state.voice.recording));
  panel.classList.toggle('busy', busy);
  if (recorder) recorder.hidden = !state.voice.recording;
  meter.style.height = `${Math.round(18 + displayLevel * 74)}%`;
  paintVoiceWaveLevel(panel, level, Boolean(state.voice.recording), waveSamples, displayLevel);
  if (timer) timer.textContent = formatVoiceDuration(state.voice.durationMs);
  status.textContent = state.voice.recording
    ? `Recording ${seconds}s  level ${displayLevel.toFixed(2)}`
    : String(state.voice.transcriptionStatus ?? 'idle');
  if (typeof document.querySelectorAll === 'function') {
    document.querySelectorAll('[data-action="voice-cancel"]').forEach((button) => {
      (button as HTMLButtonElement).disabled = !state.voice.recording;
    });
    document.querySelectorAll('[data-action="voice-toggle"]').forEach((button) => {
      const label = button.querySelector('.terminal-button__label');
      (button as HTMLButtonElement).disabled = busy;
      if (label) label.textContent = busy ? 'WAIT' : state.voice.recording ? 'SEND' : 'REC';
    });
  }
  const telemetryNow = Date.now();
  if (!state.voice.recording || telemetryNow - Number(state.voice.lastTelemetryAt ?? 0) > 500) {
    state.voice.lastTelemetryAt = telemetryNow;
    telemetry('render-voice-status', { recording: state.voice.recording, durationMs: state.voice.durationMs, level: displayLevel, rawLevel: state.voice.level, peak: normalized.peak, status: state.voice.transcriptionStatus });
  }
}
