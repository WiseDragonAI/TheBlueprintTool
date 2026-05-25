/**
 * WHAT: Renders the DroidFleet terminal voice control dock inside CoreV2.
 * WHY: CoreV2 voice notes should use the exact terminal dock class contract and waveform surface.
 */
import { attachmentStrip } from './attachment-strip.js';
import { controlDock } from './control-dock.js';

export function voiceDockSurface(): string {
  return `
    <section class="voice-style-surface" data-voice-style-surface>
      <div class="voice-terminal-status"><span>Voice input</span><span class="voice-status">idle</span></div>
      ${controlDock()}
      ${attachmentStrip()}
    </section>
  `;
}
