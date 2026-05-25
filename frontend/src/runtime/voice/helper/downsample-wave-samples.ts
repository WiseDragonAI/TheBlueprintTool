/**
 * WHAT: Compresses a full recording envelope into a bounded number of visible waveform points.
 * WHY: Long notes should preserve earlier peaks without turning the graph into a rolling recent-window view.
 */
export function downsampleWaveSamples(samples: number[], maxPoints: number): number[] {
  if (samples.length <= maxPoints) return samples;
  const bucketSize = samples.length / maxPoints;
  const values: number[] = [];
  for (let pointIndex = 0; pointIndex < maxPoints; pointIndex += 1) {
    const start = Math.floor(pointIndex * bucketSize);
    const end = Math.max(start + 1, Math.floor((pointIndex + 1) * bucketSize));
    let peak = 0;
    for (let sampleIndex = start; sampleIndex < end && sampleIndex < samples.length; sampleIndex += 1) {
      peak = Math.max(peak, samples[sampleIndex] ?? 0);
    }
    values.push(peak);
  }
  return values;
}
