/**
 * WHAT: Renders the DroidFleet terminal dock controls for decision-os voice capture.
 * WHY: Voice recording actions should use the imported STOP/wave/meter/SEND layout exactly.
 */
import { waveSvg } from './wave-svg.js';

export function controlDock(): string {
  return `
    <div class="control-dock">
      <button class="terminal-button terminal-button--stop terminal-button--stack" type="button" data-action="voice-cancel" disabled><span class="terminal-button__key">Esc</span><svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg><span class="terminal-button__label">CANCEL</span></button>
      <section class="wave-panel"><div class="wave-timer">00:00</div>${waveSvg()}</section>
      <aside class="meter-panel"><div class="meter-track"><div class="meter-fill"></div></div></aside>
      <button class="terminal-button terminal-button--send terminal-button--stack" type="button" data-action="voice-toggle"><span class="terminal-button__key">X</span><svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-5 16-3.5-6.5L4 12Z"/><path d="m11.5 13.5 4-4"/></svg><span class="terminal-button__label">REC</span></button>
    </div>
  `;
}
