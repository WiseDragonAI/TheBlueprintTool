/**
 * WHAT: Resolves whether the zoom debug overlay should be enabled on boot.
 * WHY: The overlay can be activated by URL for one repro or persisted by the console toggle for repeated checks.
 */
import { queryEnablesZoomDebug } from './query-enables-zoom-debug.js';
import { zoomDebugStorageKey } from './zoom-debug-state.js';

export function shouldEnableZoomDebug(): boolean {
  return queryEnablesZoomDebug() || localStorage.getItem(zoomDebugStorageKey) === '1';
}
