/**
 * WHAT: Paints the terminal waveform from the current real microphone level.
 * WHY: The voice dock must reflect capture state instead of replaying mock waveform data.
 */
import { buildWavePath } from '../helper/build-wave-path.js';
import { downsampleWaveSamples } from '../helper/downsample-wave-samples.js';
import { normalizeVoiceLevels } from '../helper/normalize-voice-levels.js';

const maxVisibleSamples = 340;

export function paintVoiceWaveLevel(root: ParentNode, level: number, active: boolean, recordingSamples: number[] = [], displayLevel?: number): void {
  if (typeof root.querySelectorAll !== 'function') return;
  const frameLevel = active ? Math.max(0, Math.min(1, level)) : 0;
  const normalized = normalizeVoiceLevels(recordingSamples.length ? recordingSamples : [frameLevel], frameLevel);
  const renderSamples = normalized.samples.length ? [...normalized.samples] : [normalized.level];
  if (renderSamples.length > 0 && typeof displayLevel === 'number') renderSamples[renderSamples.length - 1] = Math.max(0, Math.min(1, displayLevel));
  const visibleSamples = downsampleWaveSamples(renderSamples, maxVisibleSamples);
  const panels = Array.from(root.querySelectorAll('.wave-panel')) as HTMLElement[];
  for (const panel of panels) {
    const areaPath = panel.querySelector('.wave-area-path') as SVGPathElement | null;
    const corePath = panel.querySelector('.wave-core-path') as SVGPathElement | null;
    if (!areaPath || !corePath) continue;
    areaPath.setAttribute('d', buildWavePath(visibleSamples, 1));
    corePath.setAttribute('d', buildWavePath(visibleSamples, 0.9));
  }
}
