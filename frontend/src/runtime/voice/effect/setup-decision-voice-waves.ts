/**
 * WHAT: Feeds a right-fed accumulated amplitude model into the terminal waveform paths.
 * WHY: The decision-pane voice note must show an accumulated live envelope, not decorative sine loops.
 */

import { buildWavePath } from '../helper/build-wave-path.js';
import { voiceWaveFrameRate, voiceWavePointCount, voiceWaveTracks } from '../services/mock-voice-wave-data.js';

const pointCount = voiceWavePointCount;
const frameIntervalMs = 1000 / voiceWaveFrameRate;
const frontWaveEnabled = false;

export function setupDecisionVoiceWaves(root: ParentNode): void {
  const panels = Array.from(root.querySelectorAll('.wave-panel')) as HTMLElement[];
  panels.forEach((panel, panelIndex) => {
    if (panel.dataset.voiceWaveReady === 'true') return;
    const areaPath = panel.querySelector('.wave-area-path') as SVGPathElement | null;
    const corePath = panel.querySelector('.wave-core-path') as SVGPathElement | null;
    const meterFill = panel.parentElement?.querySelector('.meter-fill');
    if (!areaPath || !corePath) return;

    panel.dataset.voiceWaveReady = 'true';
    const samples: number[] = [];
    let smoothed = 0.26;
    let lastFrameAt = 0;
    let readIndex = 0;
    const track = voiceWaveTracks[panelIndex % voiceWaveTracks.length] || voiceWaveTracks[0] || [];

    const tick = (now: number) => {
      if (now - lastFrameAt >= frameIntervalMs) {
        const next = track[readIndex % track.length] ?? 0.18;
        smoothed += (next - smoothed) * 0.32;
        let frameLevel = smoothed;
        samples.push(frameLevel);
        if (samples.length > pointCount) {
          samples.length = 0;
          smoothed = 0.24;
          frameLevel = smoothed;
          samples.push(frameLevel);
        }
        readIndex += 1;

        areaPath.setAttribute('d', buildWavePath(samples, 1));
        panel.dataset.frontWaveEnabled = frontWaveEnabled ? 'true' : 'false';
        if (frontWaveEnabled) {
          corePath.setAttribute('d', buildWavePath(samples, 0.9));
        }
        if (meterFill instanceof HTMLElement) {
          meterFill.style.height = `${Math.round(18 + frameLevel * 74)}%`;
        }
        lastFrameAt = now;
      }
      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  });
}
