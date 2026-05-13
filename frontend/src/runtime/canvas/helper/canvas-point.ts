import { state } from '../../state.js';

export function canvasPoint(point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: (point.x - state.viewport.x) / state.viewport.scale,
    y: (point.y - state.viewport.y) / state.viewport.scale
  };
}
