/**
 * WHAT: Renders the DroidFleet terminal dock controls for CoreV2 voice capture.
 * WHY: Voice recording actions should use the imported STOP/wave/meter/SEND layout exactly.
 */
import { waveSvg } from './wave-svg.js';

export function controlDock(): string {
  return `
    <div class="control-dock">
      <button class="terminal-button terminal-button--stop terminal-button--stack" type="button" data-action="voice-cancel" disabled><span class="terminal-button__key">Esc</span><span class="terminal-button__glyph">&#9632;</span><span class="terminal-button__label">STOP</span></button>
      <section class="wave-panel"><div class="wave-timer">00:00</div>${waveSvg()}</section>
      <aside class="meter-panel"><div class="meter-track"><div class="meter-fill"></div></div></aside>
      <button class="terminal-button terminal-button--send terminal-button--stack" type="button" data-action="voice-toggle"><span class="terminal-button__key">X</span><span class="terminal-button__glyph">&#10095;</span><span class="terminal-button__label">REC</span></button>
    </div>
  `;
}
