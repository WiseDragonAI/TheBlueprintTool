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
import { dragTraceHook } from '../../performance/drag-trace-span.js';

export function handlePointerMove(event: PointerEvent): void {
  if (!state.pointer) return;
  const span = dragTraceHook();
  if (!span) {
    handlePointerMoveBody(event);
    return;
  }
  span('handlePointerMove', () => handlePointerMoveBody(event, span));
}

function handlePointerMoveBody(event: PointerEvent, span?: NonNullable<ReturnType<typeof dragTraceHook>>): void {
    event.preventDefault();
    const pointer = span ? span('handlePointerMove:point', () => point(event)) : point(event);
    const dx = pointer.x - state.pointer!.current.x;
    const dy = pointer.y - state.pointer!.current.y;
    const isPan = state.pointer!.intent === 'pan';
    const canvasPointer = isPan ? state.pointer!.currentCanvas : span ? span('handlePointerMove:canvasPoint', () => canvasPoint(pointer)) : canvasPoint(pointer);
    const canvasDx = isPan ? 0 : canvasPointer.x - state.pointer!.currentCanvas.x;
    const canvasDy = isPan ? 0 : canvasPointer.y - state.pointer!.currentCanvas.y;
    state.pointer!.current = pointer;
    state.pointer!.currentCanvas = canvasPointer;
    if (isPan) {
      const frameStartedAt = performance.now();
      state.viewport.x += dx;
      state.viewport.y += dy;
      if (span) span('handlePointerMove:applyPanViewportTransform', () => applyPanViewportTransform());
      else applyPanViewportTransform();
      if (span) span('handlePointerMove:schedulePanningEffects', () => schedulePanningEffects());
      else schedulePanningEffects();
      emitPanPerformanceTelemetry({ dx, dy, durationMs: performance.now() - frameStartedAt, frameStartedAt });
      return;
    }
    if (span) span('handlePointerMove:telemetry:canvas-pointer-move', () => telemetry('canvas-pointer-move', { intent: state.pointer!.intent, dx, dy, canvasDx, canvasDy }));
    else telemetry('canvas-pointer-move', { intent: state.pointer!.intent, dx, dy, canvasDx, canvasDy });
    if (state.pointer!.intent === 'drag' || state.pointer!.intent === 'group') {
      moveSelected(canvasDx, canvasDy);
      if (span) span('handlePointerMove:telemetry:calculate-drag-delta', () => telemetry('calculate-drag-delta', { dx, dy, canvasDx, canvasDy }));
      else telemetry('calculate-drag-delta', { dx, dy, canvasDx, canvasDy });
    }
    if (state.pointer!.intent === 'resize') {
      if (state.pointer!.targetKind === 'card') {
        if (span) span('handlePointerMove:resizeSelectedCard', () => resizeSelectedCard(canvasDx, canvasDy));
        else resizeSelectedCard(canvasDx, canvasDy);
      } else if (span) span('handlePointerMove:resizeSelectedZone', () => resizeSelectedZone(canvasDx, canvasDy));
      else resizeSelectedZone(canvasDx, canvasDy);
      if (span) span('handlePointerMove:telemetry:calculate-drag-delta', () => telemetry('calculate-drag-delta', { dx, dy, canvasDx, canvasDy, resizeHandle: state.pointer!.resizeHandle?.className }));
      else telemetry('calculate-drag-delta', { dx, dy, canvasDx, canvasDy, resizeHandle: state.pointer!.resizeHandle?.className });
    }
    if (state.pointer!.intent === 'marquee' || state.pointer!.intent === 'draw-card' || state.pointer!.intent === 'draw-zone' || state.pointer!.intent === 'draw-group') {
      const rect = span ? span('handlePointerMove:rectFromPoints', () => rectFromPoints(state.pointer!.startCanvas, canvasPointer)) : rectFromPoints(state.pointer!.startCanvas, canvasPointer);
      if (span) span('handlePointerMove:patchMarqueeBox', () => patchBox(document.querySelector('.marquee') as HTMLElement, rect.x, rect.y, rect.width, rect.height));
      else patchBox(document.querySelector('.marquee') as HTMLElement, rect.x, rect.y, rect.width, rect.height);
      if (span) span('handlePointerMove:telemetry:draft', () => telemetry(state.pointer!.intent === 'marquee' ? 'calculate-marquee-selection' : 'calculate-draft-geometry', { intent: state.pointer!.intent, rect }));
      else telemetry(state.pointer!.intent === 'marquee' ? 'calculate-marquee-selection' : 'calculate-draft-geometry', { intent: state.pointer!.intent, rect });
    }
}
