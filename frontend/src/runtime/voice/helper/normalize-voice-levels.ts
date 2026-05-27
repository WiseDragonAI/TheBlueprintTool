/**
 * WHAT: Rescales recording levels so the observed recording peak maps to 1.0.
 * WHY: Quiet microphones should still produce a meaningful waveform shape without adding a gate.
 */
export function normalizeVoiceLevels(samples: number[], currentLevel = 0): { samples: number[]; level: number; peak: number } {
  const values = [...samples.map((sample) => Math.max(0, Math.min(1, Number(sample) || 0))), Math.max(0, Math.min(1, Number(currentLevel) || 0))];
  const peak = values.reduce((max, sample) => Math.max(max, sample), 0);
  if (peak <= 0) return { samples: samples.map(() => 0), level: 0, peak: 0 };
  return {
    samples: samples.map((sample) => Math.max(0, Math.min(1, (Number(sample) || 0) / peak))),
    level: Math.max(0, Math.min(1, currentLevel / peak)),
    peak
  };
}
