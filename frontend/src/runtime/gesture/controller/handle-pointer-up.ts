import { state } from '../../state.js';
import { canvasPoint } from '../../canvas/helper/canvas-point.js';
import { createZoneController } from '../../zone/controller/create-zone-controller.js';
import { createGroupController } from '../../group/controller/create-group-controller.js';
import { finishPointer } from '../effect/finish-pointer.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { point } from '../helper/point.js';
import { rectFromPoints } from '../../canvas/helper/rect-from-points.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { selectIntersecting } from '../../selection/effect/select-intersecting.js';
import { selectTarget } from '../../selection/controller/select-target.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function handlePointerUp(event: PointerEvent): void {
  if (!state.pointer) return;
  event.preventDefault();
  telemetry('canvas-pointer-up', { intent: state.pointer.intent });
  const releasePoint = point(event);
  const moved = Math.hypot(releasePoint.x - state.pointer.start.x, releasePoint.y - state.pointer.start.y);
  if (state.pointer.intent === 'pan' && state.pointer.targetKind === 'zone' && moved < 4) {
    selectTarget('zone', state.pointer.targetId, false);
    telemetry('resolve-selection-target', { kind: 'zone', id: state.pointer.targetId, clickSelect: true });
  }
  if (state.pointer.intent === 'pan' && state.pointer.targetKind === 'group' && moved < 4) {
    selectTarget('group', state.pointer.targetId, false);
    telemetry('resolve-selection-target', { kind: 'group', id: state.pointer.targetId, clickSelect: true });
  }
  if (state.pointer.intent === 'pan' && state.pointer.targetKind === 'canvas' && moved < 4) {
    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
    (document.activeElement as HTMLElement | null)?.blur?.();
    telemetry('clear-transient-selection', { reason: 'canvas-background-click' });
  }
  if (state.pointer.intent === 'marquee') {
    const rect = rectFromPoints(state.pointer.startCanvas, canvasPoint(releasePoint));
    selectIntersecting(rect);
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    telemetry('resolve-selection-target', { selection: state.selection });
  }
  if (state.pointer.intent === 'draw-zone') {
    const rect = rectFromPoints(state.pointer.startCanvas, canvasPoint(releasePoint));
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    createZoneController(rect);
  }
  if (state.pointer.intent === 'draw-group') {
    const rect = rectFromPoints(state.pointer.startCanvas, canvasPoint(releasePoint));
    (document.querySelector('.marquee') as HTMLElement).hidden = true;
    createGroupController(rect);
  }
  persistState();
  finishPointer(event);
  renderCanvasSurface();
}
