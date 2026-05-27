/**
 * WHAT: Converts raw microphone samples into a normalized visual level without gating.
 * WHY: The voice meter must react immediately to quiet input instead of waiting for a threshold.
 */
export function calculateVoiceLevel(samples: ArrayLike<number>, options: { midpoint?: number; scale?: number; gain?: number } = {}): number {
  const length = samples.length;
  if (!length) return 0;
  const midpoint = options.midpoint ?? 0;
  const scale = options.scale ?? 1;
  const gain = options.gain ?? 4;
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    const normalized = (Number(samples[index] ?? midpoint) - midpoint) / scale;
    sum += normalized * normalized;
  }
  return Math.max(0, Math.min(1, Math.sqrt(sum / length) * gain));
}
