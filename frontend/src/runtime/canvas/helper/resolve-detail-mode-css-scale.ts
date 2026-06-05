/**
 * WHAT: Resolves the CSS scale variables used by counter-scaled low-detail labels.
 * WHY: Low-detail unzoom must not rewrite every label scale on every wheel frame.
 */
const lowDetailCssScaleBuckets = [0.08, 0.18, 0.35];

export function resolveDetailModeCssScale(scale: number, lowDetail: boolean): { viewportScale: number; inverseViewportScale: number } {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (!lowDetail) {
    // Branch: Normal detail keeps exact label scale so existing zoomed-in controls remain smooth.
    return { viewportScale: safeScale, inverseViewportScale: 1 / safeScale };
  }
  for (const bucket of lowDetailCssScaleBuckets) {
    if (safeScale <= bucket) {
      // Branch: Low detail uses the nearest upper bucket to prevent per-wheel label raster invalidation.
      return { viewportScale: bucket, inverseViewportScale: 1 / bucket };
    }
  }
  // Branch: The low-detail threshold edge itself uses the largest low-detail bucket.
  return { viewportScale: 0.35, inverseViewportScale: 1 / 0.35 };
}
