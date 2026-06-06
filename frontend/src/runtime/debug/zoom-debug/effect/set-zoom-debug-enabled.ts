/**
 * WHAT: Enables or disables the zoom debug overlay from the console hook.
 * WHY: Operators need to turn the overlay on and off without restarting the BlueprintTool server.
 */
import { renderZoomDebugOverlay } from './render-zoom-debug-overlay.js';
import { zoomDebugState, zoomDebugStorageKey } from '../helper/zoom-debug-state.js';

export function setZoomDebugEnabled(nextEnabled = true): boolean {
  zoomDebugState.enabled = nextEnabled;
  localStorage.setItem(zoomDebugStorageKey, zoomDebugState.enabled ? '1' : '0');
  if (!zoomDebugState.enabled) {
    // Branch: Disabling should remove the visual overlay while preserving the reusable state object.
    zoomDebugState.overlay?.remove();
  } else {
    // Branch: Enabling should immediately show the current scale without waiting for the next pan or wheel event.
    renderZoomDebugOverlay();
  }
  return zoomDebugState.enabled;
}
