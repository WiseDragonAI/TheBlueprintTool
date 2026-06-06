/**
 * WHAT: Handles canvas wheel zoom and Ctrl-wheel pan.
 * WHY: Wheel events should control canvas navigation unless an interactive child can consume them.
 */
import { state } from '../../state.js';
import { scheduleViewportTransform } from '../../canvas/effect/schedule-viewport-transform.js';
import { scheduleViewportPersistence } from '../../persistence/effect/schedule-viewport-persistence.js';
import { point } from '../helper/point.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { shouldCaptureWheelTarget } from '../helper/should-capture-wheel-target.js';
import { advanceCarouselFromWheel } from '../helper/advance-carousel-from-wheel.js';

export const minCanvasZoomScale = 0.03;
export const maxCanvasZoomScale = 2.2;

export function handleWheel(event: WheelEvent): void {
  if (advanceCarouselFromWheel(event)) {
    // Branch: Carousel Ctrl-wheel consumed the input and owns any media overlay update.
    return;
  }
  if (shouldCaptureWheelTarget(event)) {
    // Branch: Scrollable/editor children keep wheel events out of canvas navigation.
    return;
  }
  event.preventDefault();
  telemetry('canvas-wheel', { deltaX: event.deltaX, deltaY: event.deltaY, ctrlKey: event.ctrlKey });
  telemetry('derive-gesture-intent', { kind: event.ctrlKey ? 'pan' : 'zoom' });
  if (event.ctrlKey) {
    // Branch: Ctrl-wheel pans vertically without changing zoom detail mode.
    state.viewport.y -= event.deltaY;
    telemetry('calculate-viewport-transform', { kind: 'pan', viewport: state.viewport });
  } else {
    // Branch: Plain wheel zooms around the pointer anchor and defers DOM application to the next frame.
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
  scheduleViewportTransform();
}
