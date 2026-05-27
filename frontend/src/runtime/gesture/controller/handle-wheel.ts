/**
 * WHAT: Handles canvas wheel zoom and Ctrl-wheel pan.
 * WHY: Wheel events should control canvas navigation unless an interactive child can consume them.
 */
import { state } from '../../state.js';
import { applyViewportTransform } from '../../canvas/effect/apply-viewport-transform.js';
import { scheduleViewportPersistence } from '../../persistence/effect/schedule-viewport-persistence.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { point } from '../helper/point.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { shouldCaptureWheelTarget } from '../helper/should-capture-wheel-target.js';

export const minCanvasZoomScale = 0.03;
export const maxCanvasZoomScale = 2.2;

export function handleWheel(event: WheelEvent): void {
  if (shouldCaptureWheelTarget(event)) return;
  event.preventDefault();
  telemetry('canvas-wheel', { deltaX: event.deltaX, deltaY: event.deltaY, ctrlKey: event.ctrlKey });
  telemetry('derive-gesture-intent', { kind: event.ctrlKey ? 'pan' : 'zoom' });
  if (event.ctrlKey) {
    state.viewport.y -= event.deltaY;
    telemetry('calculate-viewport-transform', { kind: 'pan', viewport: state.viewport });
  } else {
    const pointer = point(event);
    const oldScale = state.viewport.scale;
    const anchoredCanvasPoint = {
      x: (pointer.x - state.viewport.x) / oldScale,
      y: (pointer.y - state.viewport.y) / oldScale
    };
    const nextScale = state.viewport.scale * Math.exp(-event.deltaY * 0.0015);
    state.viewport.scale = Math.min(maxCanvasZoomScale, Math.max(minCanvasZoomScale, nextScale));
    state.viewport.x = pointer.x - anchoredCanvasPoint.x * state.viewport.scale;
    state.viewport.y = pointer.y - anchoredCanvasPoint.y * state.viewport.scale;
    telemetry('calculate-viewport-transform', { kind: 'zoom', pointer, anchoredCanvasPoint, viewport: state.viewport });
  }
  scheduleViewportPersistence();
  applyViewportTransform();
  renderRelationshipOverlay();
}
