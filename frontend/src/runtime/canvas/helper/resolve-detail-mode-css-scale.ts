/**
 * WHAT: Resolves the CSS scale variables used by counter-scaled low-detail labels.
 * WHY: Two-mode zoom should keep readable low-detail text without introducing extra threshold bands.
 */
const lowDetailMinimumScale = 0.08;

export function resolveDetailModeCssScale(scale: number, lowDetail: boolean): { viewportScale: number; inverseViewportScale: number } {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  // Branch: Detail mode keeps readable controls tied exactly to the live zoom level.
  if (!lowDetail) {
    return { viewportScale: safeScale, inverseViewportScale: 1 / safeScale };
  }
  const viewportScale = Math.max(lowDetailMinimumScale, safeScale);
  // Branch: Low detail follows the live zoom until the readable scale clamp takes over deep unzoom.
  return { viewportScale, inverseViewportScale: 1 / viewportScale };
}
