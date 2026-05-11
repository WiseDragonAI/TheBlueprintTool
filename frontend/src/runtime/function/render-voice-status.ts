import { state } from '../state.js';
import { telemetry } from './telemetry.js';

export function renderVoiceStatus(): void {
  (document.querySelector('.voice-status') as HTMLElement).textContent = `${state.voice.transcriptionStatus} ${state.voice.durationMs}ms level:${state.voice.level}`;
  telemetry('render-voice-status', state.voice);
}
