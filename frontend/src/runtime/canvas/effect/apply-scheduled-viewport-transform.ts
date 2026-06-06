/**
 * WHAT: Applies the latest queued viewport transform from a scheduled frame callback.
 * WHY: Wheel bursts should render the newest viewport once per frame instead of once per event.
 */
import { applyViewportTransform } from './apply-viewport-transform.js';
import { scheduledViewportTransformState } from './scheduled-viewport-transform-state.js';

export function applyScheduledViewportTransform(): void {
  scheduledViewportTransformState.scheduled = false;
  applyViewportTransform();
}
