/**
 * WHAT: Finalizes pointer gestures and routes completed canvas actions through controllers.
 * WHY: Pointer release is the canonical boundary for selection, creation, geometry commits, and thread context.
 */
import { state } from '../../state.js';
import { canvasPoint } from '../../canvas/helper/canvas-point.js';
import { createCardController } from '../../card/controller/create-card-controller.js';
import { createZoneController } from '../../zone/controller/create-zone-controller.js';
import { createGroupController } from '../../group/controller/create-group-controller.js';
import { commitSelectedLedgerGeometry } from '../../ledger/effect/commit-selected-ledger-geometry.js';
import { finishPointer } from '../effect/finish-pointer.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { point } from '../helper/point.js';
import { rectFromPoints } from '../../canvas/helper/rect-from-points.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { selectIntersecting } from '../../selection/effect/select-intersecting.js';
import { selectTarget } from '../../selection/controller/select-target.js';
import { moveSelected } from '../../selection/effect/move-selected.js';
import { resizeSelectedCard } from '../../card/effect/resize-selected-card.js';
import { resizeSelectedZone } from '../../zone/effect/resize-selected-zone.js';
import { isClickMovement, pointerDistancePx } from '../helper/click-movement.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function handlePointerUp(event: PointerEvent): Promise<void> {
  if (!state.pointer) return;
  event.preventDefault();
  const pointerSession = state.pointer;
  const pointerIntent = pointerSession.intent;
  let releaseRendered = false;
  telemetry('canvas-pointer-up', { intent: pointerIntent });
  const releasePoint = point(event);
  const releaseCanvas = canvasPoint(releasePoint);
  const moved = pointerDistancePx(pointerSession.start, releasePoint);
  const isForcedPan = Boolean(pointerSession.forcedPan || pointerSession.ctrlPan);
  if (!isForcedPan && pointerIntent === 'pan' && pointerSession.targetKind === 'zone' && isClickMovement(moved)) {
    selectTarget('zone', pointerSession.targetId, false);
    telemetry('resolve-selection-target', { kind: 'zone', id: pointerSession.targetId, clickSelect: true });
  }
  if (!isForcedPan && pointerIntent === 'pan' && pointerSession.targetKind === 'group' && isClickMovement(moved)) {
    selectTarget('group', pointerSession.targetId, false);
    telemetry('resolve-selection-target', { kind: 'group', id: pointerSession.targetId, clickSelect: true });
  }
  if (pointerIntent === 'marquee') {
    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
    selectIntersecting(rect);
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    telemetry('resolve-selection-target', { selection: state.selection });
  }
  if (pointerIntent === 'draw-card') {
    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    finishPointer(event);
    await createCardController(rect);
  }
  if (pointerIntent === 'draw-zone') {
    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    finishPointer(event);
    await createZoneController(rect);
  }
  if (pointerIntent === 'draw-group') {
    const rect = rectFromPoints(pointerSession.startCanvas, releaseCanvas);
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    finishPointer(event);
    await createGroupController(rect);
  }
  if ((pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') && isClickMovement(moved)) {
    finishPointer(event);
    persistState();
    return;
  }
  if (pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') {
    const gestureSelection = pointerSession.selectionSnapshot ?? state.selection;
    const canvasDx = releaseCanvas.x - pointerSession.currentCanvas.x;
    const canvasDy = releaseCanvas.y - pointerSession.currentCanvas.y;
    if (canvasDx || canvasDy) {
      if (pointerIntent === 'drag' || pointerIntent === 'group') moveSelected(canvasDx, canvasDy, gestureSelection);
      if (pointerIntent === 'resize') {
        if (pointerSession.targetKind === 'card') resizeSelectedCard(canvasDx, canvasDy);
        else resizeSelectedZone(canvasDx, canvasDy);
      }
    }
    finishPointer(event);
    releaseRendered = await commitSelectedLedgerGeometry(gestureSelection);
  }
  if (pointerIntent === 'pan' || pointerIntent === 'marquee') finishPointer(event);
  persistState();
  if (pointerIntent !== 'pan' && !releaseRendered) renderCanvasSurface();
}
