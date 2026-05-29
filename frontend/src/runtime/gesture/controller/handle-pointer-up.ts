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
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function handlePointerUp(event: PointerEvent): Promise<void> {
  if (!state.pointer) return;
  event.preventDefault();
  const pointerIntent = state.pointer.intent;
  telemetry('canvas-pointer-up', { intent: pointerIntent });
  const releasePoint = point(event);
  const moved = Math.hypot(releasePoint.x - state.pointer.start.x, releasePoint.y - state.pointer.start.y);
  const isCtrlPan = Boolean(state.pointer.ctrlPan);
  if (!isCtrlPan && pointerIntent === 'pan' && state.pointer.targetKind === 'zone' && moved < 4) {
    selectTarget('zone', state.pointer.targetId, false);
    telemetry('resolve-selection-target', { kind: 'zone', id: state.pointer.targetId, clickSelect: true });
  }
  if (!isCtrlPan && pointerIntent === 'pan' && state.pointer.targetKind === 'group' && moved < 4) {
    selectTarget('group', state.pointer.targetId, false);
    telemetry('resolve-selection-target', { kind: 'group', id: state.pointer.targetId, clickSelect: true });
  }
  if (pointerIntent === 'marquee') {
    const rect = rectFromPoints(state.pointer.startCanvas, canvasPoint(releasePoint));
    selectIntersecting(rect);
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    telemetry('resolve-selection-target', { selection: state.selection });
  }
  if (pointerIntent === 'draw-card') {
    const rect = rectFromPoints(state.pointer.startCanvas, canvasPoint(releasePoint));
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    await createCardController(rect);
  }
  if (pointerIntent === 'draw-zone') {
    const rect = rectFromPoints(state.pointer.startCanvas, canvasPoint(releasePoint));
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    await createZoneController(rect);
  }
  if (pointerIntent === 'draw-group') {
    const rect = rectFromPoints(state.pointer.startCanvas, canvasPoint(releasePoint));
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    await createGroupController(rect);
  }
  if (pointerIntent === 'drag' || pointerIntent === 'group' || pointerIntent === 'resize') {
    await commitSelectedLedgerGeometry();
  }
  persistState();
  finishPointer(event);
  if (pointerIntent !== 'pan') renderCanvasSurface();
}
