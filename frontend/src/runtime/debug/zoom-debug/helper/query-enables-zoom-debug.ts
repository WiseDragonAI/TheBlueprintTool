/**
 * WHAT: Reads URL parameters that enable the zoom debug overlay.
 * WHY: The operator needs a shareable route flag for reproducing zoom thresholds.
 */
export function queryEnablesZoomDebug(): boolean {
  const params = new URLSearchParams(window.location.search);
  const zoomDebugValue = params.get('zoomDebug');
  const debugZoomValue = params.get('debugZoom');
  const detailMountDebugValue = params.get('detailMountDebug');
  if (params.has('zoomDebug')) {
    // Branch: A bare ?zoomDebug flag should enable the overlay because it is easiest to type during repro.
    return zoomDebugValue !== '0' && zoomDebugValue !== 'false';
  }
  if (params.has('debugZoom')) {
    // Branch: Keep the alternate flag for older debug links while allowing explicit opt-out values.
    return debugZoomValue !== '0' && debugZoomValue !== 'false';
  }
  if (params.has('detailMountDebug')) {
    // Branch: Detail mount repro links should light up the same debug surface without needing the older zoom flag.
    return detailMountDebugValue !== '0' && detailMountDebugValue !== 'false';
  }
  // Branch: The generic debug parameter keeps feature debug routes grouped under one convention.
  return params.get('debug') === 'zoom' || params.get('debug') === 'detail-mount';
}
