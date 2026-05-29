/**
 * WHAT: Applies active pointer gesture movement to the canvas runtime.
 * WHY: Pan must stay transform-only while drag, resize, and draw paths update their owned geometry.
 */
import { state } from '../../state.js';
import { applyViewportTransform } from '../../canvas/effect/apply-viewport-transform.js';
import { applyPanViewportTransform } from '../../canvas/effect/apply-pan-viewport-transform.js';
import { canvasPoint } from '../../canvas/helper/canvas-point.js';
import { moveSelected } from '../../selection/effect/move-selected.js';
import { patchBox } from '../../canvas/effect/patch-box.js';
import { point } from '../helper/point.js';
import { rectFromPoints } from '../../canvas/helper/rect-from-points.js';
import { resizeSelectedCard } from '../../card/effect/resize-selected-card.js';
import { resizeSelectedZone } from '../../zone/effect/resize-selected-zone.js';
import { emitPanPerformanceTelemetry } from '../effect/emit-pan-performance-telemetry.js';
import { schedulePanningEffects } from '../effect/schedule-panning-effects.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function handlePointerMove(event: PointerEvent): void {
  if (!state.pointer) return;
  event.preventDefault();
  const pointer = point(event);
  const dx = pointer.x - state.pointer.current.x;
  const dy = pointer.y - state.pointer.current.y;
  const isPan = state.pointer.intent === 'pan';
  const canvasPointer = isPan ? state.pointer.currentCanvas : canvasPoint(pointer);
  const canvasDx = isPan ? 0 : canvasPointer.x - state.pointer.currentCanvas.x;
  const canvasDy = isPan ? 0 : canvasPointer.y - state.pointer.currentCanvas.y;
  state.pointer.current = pointer;
  state.pointer.currentCanvas = canvasPointer;
  if (isPan) {
    const frameStartedAt = performance.now();
    state.viewport.x += dx;
    state.viewport.y += dy;
    applyPanViewportTransform();
    schedulePanningEffects();
    emitPanPerformanceTelemetry({ dx, dy, durationMs: performance.now() - frameStartedAt, frameStartedAt });
    return;
  }
  telemetry('canvas-pointer-move', { intent: state.pointer.intent, dx, dy, canvasDx, canvasDy });
  if (state.pointer.intent === 'drag' || state.pointer.intent === 'group') {
    moveSelected(canvasDx, canvasDy);
    telemetry('calculate-drag-delta', { dx, dy, canvasDx, canvasDy });
  }
  if (state.pointer.intent === 'resize') {
    if (state.pointer.targetKind === 'card') resizeSelectedCard(canvasDx, canvasDy);
    else resizeSelectedZone(canvasDx, canvasDy);
    telemetry('calculate-drag-delta', { dx, dy, canvasDx, canvasDy, resizeHandle: state.pointer.resizeHandle?.className });
  }
  if (state.pointer.intent === 'marquee' || state.pointer.intent === 'draw-card' || state.pointer.intent === 'draw-zone' || state.pointer.intent === 'draw-group') {
    const rect = rectFromPoints(state.pointer.startCanvas, canvasPointer);
    patchBox(document.querySelector('.marquee') as HTMLElement, rect.x, rect.y, rect.width, rect.height);
    telemetry(state.pointer.intent === 'marquee' ? 'calculate-marquee-selection' : 'calculate-draft-geometry', { intent: state.pointer.intent, rect });
  }
}
