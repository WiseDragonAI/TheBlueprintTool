/**
 * WHAT: Schedules one viewport transform application for the next frame.
 * WHY: Repeated wheel zooms must coalesce expensive style and raster work.
 */
import { applyScheduledViewportTransform } from './apply-scheduled-viewport-transform.js';
import { scheduledViewportTransformState } from './scheduled-viewport-transform-state.js';

export function scheduleViewportTransform(): void {
  if (scheduledViewportTransformState.scheduled) {
    // Branch: A frame is already queued, so the latest viewport state will be applied by that callback.
    return;
  }
  scheduledViewportTransformState.scheduled = true;
  if (typeof requestAnimationFrame === 'function') {
    // Branch: Use RAF in the browser so wheel bursts collapse to the next visual frame.
    requestAnimationFrame(applyScheduledViewportTransform);
  } else {
    // Branch: Fall back to a timer for non-browser test environments.
    setTimeout(applyScheduledViewportTransform, 0);
  }
}
