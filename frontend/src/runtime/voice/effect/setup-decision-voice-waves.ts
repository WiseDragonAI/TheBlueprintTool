/**
 * WHAT: Initializes terminal waveform paths before real microphone samples arrive.
 * WHY: The recorder surface should be flat while idle and only move from live voice levels.
 */

import { buildWavePath } from '../helper/build-wave-path.js';

export function setupDecisionVoiceWaves(root: ParentNode): void {
  const panels = Array.from(root.querySelectorAll('.wave-panel')) as HTMLElement[];
  panels.forEach((panel) => {
    if (panel.dataset.voiceWaveReady === 'true') return;
    const areaPath = panel.querySelector('.wave-area-path') as SVGPathElement | null;
    const corePath = panel.querySelector('.wave-core-path') as SVGPathElement | null;
    if (!areaPath || !corePath) return;
    panel.dataset.voiceWaveReady = 'true';
    panel.dataset.frontWaveEnabled = 'false';
    areaPath.setAttribute('d', buildWavePath([0], 1));
    corePath.setAttribute('d', buildWavePath([0], 0.9));
  });
}
