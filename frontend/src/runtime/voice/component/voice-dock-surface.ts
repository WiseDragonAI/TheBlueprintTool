/**
 * WHAT: Renders the DroidFleet terminal voice control dock inside CoreV2.
 * WHY: CoreV2 voice notes should use the exact terminal dock class contract and waveform surface.
 */
import { controlDock } from './control-dock.js';
import { terminalComposer } from './terminal-composer.js';

export function voiceDockSurface(): string {
  return `
    <section class="voice-style-surface" data-voice-style-surface>
      <div class="voice-terminal-status"><span>Thread input</span><span class="voice-status">idle</span></div>
      ${terminalComposer()}
      <div class="voice-recorder" hidden>
        ${controlDock()}
      </div>
    </section>
  `;
}
