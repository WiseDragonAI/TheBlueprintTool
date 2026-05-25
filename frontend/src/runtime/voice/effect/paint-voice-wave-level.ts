/**
 * WHAT: Paints the terminal waveform from the current real microphone level.
 * WHY: The voice dock must reflect capture state instead of replaying mock waveform data.
 */
import { buildWavePath } from '../helper/build-wave-path.js';
import { downsampleWaveSamples } from '../helper/downsample-wave-samples.js';

const maxVisibleSamples = 340;

export function paintVoiceWaveLevel(root: ParentNode, level: number, active: boolean, recordingSamples: number[] = []): void {
  if (typeof root.querySelectorAll !== 'function') return;
  const frameLevel = active ? Math.max(0, Math.min(1, level)) : 0;
  const visibleSamples = downsampleWaveSamples(recordingSamples.length ? recordingSamples : [frameLevel], maxVisibleSamples);
  const panels = Array.from(root.querySelectorAll('.wave-panel')) as HTMLElement[];
  for (const panel of panels) {
    const areaPath = panel.querySelector('.wave-area-path') as SVGPathElement | null;
    const corePath = panel.querySelector('.wave-core-path') as SVGPathElement | null;
    if (!areaPath || !corePath) continue;
    areaPath.setAttribute('d', buildWavePath(visibleSamples, 1));
    corePath.setAttribute('d', buildWavePath(visibleSamples, 0.9));
  }
}
