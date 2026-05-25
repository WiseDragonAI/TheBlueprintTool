import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { paintVoiceWaveLevel } from './paint-voice-wave-level.js';

export function renderVoiceStatus(): void {
  const status = document.querySelector('.voice-status') as HTMLElement | null;
  const meter = (document.querySelector('.meter-fill') ?? document.querySelector('.voice-meter-value')) as HTMLElement | null;
  const timer = document.querySelector('.wave-timer') as HTMLElement | null;
  const panel = document.querySelector('.voice-panel') as HTMLElement | null;
  const recorder = document.querySelector('.voice-recorder') as HTMLElement | null;
  if (!status || !meter || !panel) return;
  const seconds = (Number(state.voice.durationMs ?? 0) / 1000).toFixed(1);
  const wholeSeconds = Math.max(0, Math.floor(Number(state.voice.durationMs ?? 0) / 1000));
  const level = Math.max(0, Math.min(1, Number(state.voice.level ?? 0)));
  const waveSamples = Array.isArray(state.voice.waveSamples) ? state.voice.waveSamples : [];
  const busy = /transcribing|uploading/.test(String(state.voice.transcriptionStatus ?? ''));
  panel.classList.toggle('recording', Boolean(state.voice.recording));
  panel.classList.toggle('busy', busy);
  if (recorder) recorder.hidden = !state.voice.recording && !busy;
  meter.style.height = `${Math.round(18 + level * 74)}%`;
  paintVoiceWaveLevel(panel, level, Boolean(state.voice.recording || busy), waveSamples);
  if (timer) timer.textContent = `00:${String(wholeSeconds).padStart(2, '0')}`;
  status.textContent = state.voice.recording
    ? `Recording ${seconds}s  level ${level.toFixed(2)}`
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
  const now = Date.now();
  if (!state.voice.recording || now - Number(state.voice.lastTelemetryAt ?? 0) > 500) {
    state.voice.lastTelemetryAt = now;
    telemetry('render-voice-status', { recording: state.voice.recording, durationMs: state.voice.durationMs, level: state.voice.level, status: state.voice.transcriptionStatus });
  }
}
