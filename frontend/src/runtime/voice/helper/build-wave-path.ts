/**
 * WHAT: Converts normalized amplitude samples into the terminal waveform path.
 * WHY: The copied DroidFleet animation updates SVG paths rather than canvas pixels.
 */
const viewBoxWidth = 1000;
const viewBoxHeight = 100;
const baseline = 100;
const maxAmplitude = 72;

export function buildWavePath(samples: number[], amplitudeScale: number): string {
  const values = samples.length ? samples : [0];
  const step = values.length > 1 ? viewBoxWidth / (values.length - 1) : viewBoxWidth;
  const coordinates = values.map((value, index) => ({
    x: values.length === 1 ? viewBoxWidth : index * step,
    y: baseline - Math.pow(value, 0.78) * maxAmplitude * amplitudeScale,
  }));

  let path = `M0 ${baseline}`;
  if (coordinates.length === 1) {
    const point = coordinates[0];
    path += ` L0 ${point.y.toFixed(1)} L${viewBoxWidth} ${point.y.toFixed(1)}`;
    path += ` L${viewBoxWidth} ${viewBoxHeight} L0 ${viewBoxHeight} Z`;
    return path;
  }

  coordinates.forEach((point, index) => {
    if (index === 0) {
      path += ` L${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      return;
    }
    const previous = coordinates[index - 1];
    path += ` Q${previous.x.toFixed(1)} ${previous.y.toFixed(1)} ${((previous.x + point.x) / 2).toFixed(1)} ${((previous.y + point.y) / 2).toFixed(1)}`;
  });
  path += ` L${viewBoxWidth} ${viewBoxHeight} L0 ${viewBoxHeight} Z`;
  return path;
}
