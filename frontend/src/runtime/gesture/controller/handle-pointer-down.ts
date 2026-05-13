import { canvas } from '../../dom.js';
import { state } from '../../state.js';
import { derivePointerIntent } from '../helper/derive-pointer-intent.js';
import { canvasPoint } from '../../canvas/helper/canvas-point.js';
import { patchBox } from '../../canvas/effect/patch-box.js';
import { point } from '../helper/point.js';
import { selectTarget } from '../../selection/controller/select-target.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function handlePointerDown(event: PointerEvent): void {
  const rawTarget = event.target as HTMLElement;
  if (rawTarget.closest('button,input,textarea,select,[data-action]')) return;
  event.preventDefault();
  const resizeHandle = rawTarget.closest('.resize-handle') as HTMLElement | null;
  const target = rawTarget.closest('[data-card-id],[data-zone-id],[data-group-id]') as HTMLElement | null;
  const targetKind = target?.dataset.cardId ? 'card' : target?.dataset.groupId ? 'group' : target?.dataset.zoneId ? 'zone' : 'canvas';
  const targetId = target?.dataset.cardId ?? target?.dataset.groupId ?? target?.dataset.zoneId ?? '';
  const pointer = point(event);
  const canvasPointer = canvasPoint(pointer);
  const intent = derivePointerIntent(event, targetKind, resizeHandle);
  state.pointer = { intent, resizeHandle, target, targetKind, targetId, start: pointer, current: pointer, startCanvas: canvasPointer, currentCanvas: canvasPointer };
  telemetry('canvas-pointer-down', { intent, targetKind, targetId, ctrlKey: event.ctrlKey });
  telemetry('derive-gesture-intent', { kind: intent });
  if (intent === 'drag' || intent === 'group') selectTarget(targetKind, targetId, event.ctrlKey);
  if (intent === 'resize') selectTarget(targetKind, targetId, false);
  if (intent === 'marquee' || intent === 'draw-zone' || intent === 'draw-group') {
    const marquee = document.querySelector('.marquee') as HTMLElement;
    marquee.hidden = false;
    patchBox(marquee, canvasPointer.x, canvasPointer.y, 0, 0);
  }
  canvas.setPointerCapture?.(event.pointerId);
}
