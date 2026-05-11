import { state } from '../state.js';
import { persistState } from './persist-state.js';
import { point } from './point.js';
import { renderCanvasSurface } from './render-canvas-surface.js';
import { telemetry } from './telemetry.js';

export function handleWheel(event: WheelEvent): void {
  event.preventDefault();
  telemetry('canvas-wheel', { deltaX: event.deltaX, deltaY: event.deltaY, ctrlKey: event.ctrlKey });
  telemetry('derive-gesture-intent', { kind: event.ctrlKey ? 'pan' : 'zoom' });
  if (event.ctrlKey) {
    state.viewport.x -= event.deltaX || event.deltaY;
    state.viewport.y -= event.deltaY;
    telemetry('calculate-viewport-transform', { kind: 'pan', viewport: state.viewport });
  } else {
    const pointer = point(event);
    const oldScale = state.viewport.scale;
    const anchoredCanvasPoint = {
      x: (pointer.x - state.viewport.x) / oldScale,
      y: (pointer.y - state.viewport.y) / oldScale
    };
    const nextScale = state.viewport.scale * (event.deltaY > 0 ? 0.92 : 1.08);
    state.viewport.scale = Math.min(2.5, Math.max(0.08, nextScale));
    state.viewport.x = pointer.x - anchoredCanvasPoint.x * state.viewport.scale;
    state.viewport.y = pointer.y - anchoredCanvasPoint.y * state.viewport.scale;
    telemetry('calculate-viewport-transform', { kind: 'zoom', pointer, anchoredCanvasPoint, viewport: state.viewport });
  }
  persistState();
  renderCanvasSurface();
}
