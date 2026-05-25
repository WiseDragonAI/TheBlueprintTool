/**
 * WHAT: Paints the terminal waveform from the current real microphone level.
 * WHY: The voice dock must reflect capture state instead of replaying mock waveform data.
 */
import { buildWavePath } from '../helper/build-wave-path.js';

const samplesByPanel = new WeakMap<HTMLElement, number[]>();
const maxSamples = 160;

export function paintVoiceWaveLevel(root: ParentNode, level: number, active: boolean): void {
  if (typeof root.querySelectorAll !== 'function') return;
  const frameLevel = active ? Math.max(0, Math.min(1, level)) : 0;
  const panels = Array.from(root.querySelectorAll('.wave-panel')) as HTMLElement[];
  for (const panel of panels) {
    const areaPath = panel.querySelector('.wave-area-path') as SVGPathElement | null;
    const corePath = panel.querySelector('.wave-core-path') as SVGPathElement | null;
    if (!areaPath || !corePath) continue;
    const samples = active ? (samplesByPanel.get(panel) ?? []) : [];
    samples.push(frameLevel);
    while (samples.length > maxSamples) samples.shift();
    samplesByPanel.set(panel, samples);
    const values = samples.length ? samples : [0];
    areaPath.setAttribute('d', buildWavePath(values, 1));
    corePath.setAttribute('d', buildWavePath(values, 0.9));
  }
}
