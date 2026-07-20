/**
 * WHAT: Renders the DroidFleet terminal dock controls for decision-os voice capture.
 * WHY: Voice recording actions should use the imported STOP/wave/meter/SEND layout exactly.
 */
import { waveSvg } from './wave-svg.js';
import type { VoiceLaunchMode } from '../helper/voice-launch-mode.js';

export function voiceActionIcon(mode: VoiceLaunchMode): string {
  if (mode === 'run') return '<svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  if (mode === 'pipeline') return '<svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h5v5H5zM14 13h5v5h-5zM10 8.5h4a2 2 0 0 1 2 2V13"/></svg>';
  return '<svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-5 16-3.5-6.5L4 12Z"/><path d="m11.5 13.5 4-4"/></svg>';
}

export function controlDock(): string {
  return `
    <div class="control-dock">
      <button class="terminal-button terminal-button--stop terminal-button--stack voice-cancel-control" type="button" data-action="voice-cancel" disabled><span class="terminal-button__key">Esc</span><svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg><span class="terminal-button__label">CANCEL</span></button>
      <section class="wave-panel"><div class="wave-timer">00:00</div>${waveSvg()}</section>
      <aside class="meter-panel"><div class="meter-track"><div class="meter-fill"></div></div></aside>
      <button class="terminal-button terminal-button--send terminal-button--stack voice-action voice-action--send" type="button" data-action="voice-stop" data-launch-mode="send"><span class="terminal-button__key">X</span>${voiceActionIcon('send')}<span class="terminal-button__label">SEND</span></button>
      <button class="terminal-button terminal-button--send terminal-button--stack voice-action voice-action--run" type="button" data-action="voice-stop" data-launch-mode="run"><span class="terminal-button__key">Shift+X</span>${voiceActionIcon('run')}<span class="terminal-button__label">RUN</span></button>
      <button class="terminal-button terminal-button--send terminal-button--stack voice-action voice-action--pipeline" type="button" data-action="voice-stop" data-launch-mode="pipeline"><span class="terminal-button__key">Ctrl+X</span>${voiceActionIcon('pipeline')}<span class="terminal-button__label">PIPELINE</span></button>
    </div>
  `;
}
