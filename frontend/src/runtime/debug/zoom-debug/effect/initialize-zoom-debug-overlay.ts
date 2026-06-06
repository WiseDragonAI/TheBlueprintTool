/**
 * WHAT: Installs the zoom debug overlay toggle and applies boot-time enablement.
 * WHY: Debug UI should be available from a URL flag or console hook before the first zoom repro.
 */
import '../helper/zoom-debug-window.js';
import { renderZoomDebugOverlay } from './render-zoom-debug-overlay.js';
import { setZoomDebugEnabled } from './set-zoom-debug-enabled.js';
import { shouldEnableZoomDebug } from '../helper/should-enable-zoom-debug.js';
import { zoomDebugState } from '../helper/zoom-debug-state.js';

export function initializeZoomDebugOverlay(): void {
  if (zoomDebugState.initialized) {
    // Branch: Boot can render more than once, but the console hook must only be installed once.
    return;
  }
  zoomDebugState.initialized = true;
  zoomDebugState.enabled = shouldEnableZoomDebug();
  window.corev2ZoomDebug = setZoomDebugEnabled;
  if (zoomDebugState.enabled) {
    // Branch: URL or persisted opt-in should render immediately on boot.
    renderZoomDebugOverlay();
  }
}
