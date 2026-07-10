/**
 * WHAT: Mounts the terminal voice dock and starts its waveform animation.
 * WHY: The dock is template-rendered while the waveform needs one-time DOM setup.
 */
import { voiceDockSurface } from '../component/voice-dock-surface.js';
import { setupDecisionVoiceWaves } from './setup-decision-voice-waves.js';

export function renderVoiceDock(options: { visible?: boolean } = {}): void {
  const dock = document.querySelector('.voice-panel') as HTMLElement | null;
  if (!dock) return;
  dock.hidden = options.visible === false;
  if (options.visible === false) return;
  if (!('dataset' in dock)) return;
  if (dock.dataset.voiceDockMounted !== 'true') {
    dock.innerHTML = voiceDockSurface();
    dock.dataset.voiceDockMounted = 'true';
  }
  setupDecisionVoiceWaves(dock);
}
