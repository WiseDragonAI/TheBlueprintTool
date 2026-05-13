import { state } from '../../state.js';
import { canvasPoint } from '../../canvas/helper/canvas-point.js';
import { moveSelected } from '../../selection/effect/move-selected.js';
import { patchBox } from '../../canvas/effect/patch-box.js';
import { point } from '../helper/point.js';
import { rectFromPoints } from '../../canvas/helper/rect-from-points.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { resizeSelectedZone } from '../../zone/effect/resize-selected-zone.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function handlePointerMove(event: PointerEvent): void {
  if (!state.pointer) return;
  event.preventDefault();
  const pointer = point(event);
  const canvasPointer = canvasPoint(pointer);
  const dx = pointer.x - state.pointer.current.x;
  const dy = pointer.y - state.pointer.current.y;
  const canvasDx = canvasPointer.x - state.pointer.currentCanvas.x;
  const canvasDy = canvasPointer.y - state.pointer.currentCanvas.y;
  state.pointer.current = pointer;
  state.pointer.currentCanvas = canvasPointer;
  telemetry('canvas-pointer-move', { intent: state.pointer.intent, dx, dy, canvasDx, canvasDy });
  if (state.pointer.intent === 'pan') {
    state.viewport.x += dx;
    state.viewport.y += dy;
    telemetry('calculate-viewport-transform', { kind: 'pan', viewport: state.viewport });
    renderCanvasSurface();
  }
  if (state.pointer.intent === 'drag' || state.pointer.intent === 'group') {
    moveSelected(canvasDx, canvasDy);
    telemetry('calculate-drag-delta', { dx, dy, canvasDx, canvasDy });
    telemetry('commit-ledger-edit', { targetId: state.pointer.targetId });
  }
  if (state.pointer.intent === 'resize') {
    resizeSelectedZone(canvasDx, canvasDy);
    telemetry('calculate-drag-delta', { dx, dy, canvasDx, canvasDy, resizeHandle: state.pointer.resizeHandle?.className });
    telemetry('commit-ledger-edit', { resizeZone: state.pointer.targetId });
  }
  if (state.pointer.intent === 'marquee' || state.pointer.intent === 'draw-zone' || state.pointer.intent === 'draw-group') {
    const rect = rectFromPoints(state.pointer.startCanvas, canvasPointer);
    patchBox(document.querySelector('.marquee') as HTMLElement, rect.x, rect.y, rect.width, rect.height);
    telemetry(state.pointer.intent === 'marquee' ? 'calculate-marquee-selection' : 'calculate-zone-draft-geometry', rect);
  }
}
