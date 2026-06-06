/**
 * WHAT: Resolves or creates the fixed zoom debug overlay element.
 * WHY: Repeated viewport updates should reuse one debug node instead of recreating DOM.
 */
import { zoomDebugState } from './zoom-debug-state.js';

export function resolveZoomDebugOverlay(): HTMLElement {
  if (zoomDebugState.overlay?.isConnected) {
    // Branch: The existing overlay is still mounted, so reuse it without querying the document.
    return zoomDebugState.overlay;
  }
  const existing = document.querySelector('.zoom-debug-overlay') as HTMLElement | null;
  if (existing) {
    // Branch: A server or previous runtime pass already created the overlay; keep ownership in shared state.
    zoomDebugState.overlay = existing;
    return zoomDebugState.overlay;
  }
  zoomDebugState.overlay = document.createElement('div');
  zoomDebugState.overlay.className = 'zoom-debug-overlay';
  zoomDebugState.overlay.setAttribute('role', 'status');
  zoomDebugState.overlay.setAttribute('aria-live', 'polite');
  document.body.append(zoomDebugState.overlay);
  return zoomDebugState.overlay;
}
