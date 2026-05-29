/**
 * WHAT: Starts canvas pointer gestures and resolves their target intent.
 * WHY: Drag, pan, resize, draw, and edit control flow must share one canonical pointer entrypoint.
 */
import { canvas } from '../../dom.js';
import { state } from '../../state.js';
import { derivePointerIntent } from '../helper/derive-pointer-intent.js';
import { canvasPoint } from '../../canvas/helper/canvas-point.js';
import { patchBox } from '../../canvas/effect/patch-box.js';
import { beginLedgerCardDescriptionEdit, beginLedgerCardTitleEdit } from '../../card/effect/begin-ledger-card-edit.js';
import { isGestureControlTarget } from '../helper/is-gesture-control-target.js';
import { point } from '../helper/point.js';
import { shouldPreservePointerSelection } from '../../selection/helper/should-preserve-pointer-selection.js';
import { selectTarget } from '../../selection/controller/select-target.js';
import { renderSelectionState } from '../../selection/effect/render-selection-state.js';
import { selectThread } from '../../thread/effect/select-thread.js';
import { closeThreadPanel } from '../../thread/effect/close-thread-panel.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

let lastCardEditClick: { area: 'body' | 'title'; cardId: string; at: number } | null = null;

export function handlePointerDown(event: PointerEvent): void {
  const rawTarget = event.target as HTMLElement;
  if (isGestureControlTarget(rawTarget)) return;
  const editedCard = rawTarget.closest('[data-card-id]') as HTMLElement | null;
  const editArea = rawTarget.closest('.ledger-card-title') ? 'title' : rawTarget.closest('.ledger-card-body') ? 'body' : '';
  const editedCardId = editedCard?.dataset.cardId ?? '';
  const now = performance.now();
  const isCardEditDoubleClick = Boolean(
    editedCardId
      && editArea
      && lastCardEditClick
      && lastCardEditClick.cardId === editedCardId
      && lastCardEditClick.area === editArea
      && now - lastCardEditClick.at < 480,
  );
  if (editedCardId && editArea) {
    lastCardEditClick = { area: editArea, cardId: editedCardId, at: now };
  }
  if ((event.detail >= 2 || isCardEditDoubleClick) && editedCard) {
    event.preventDefault();
    event.stopPropagation();
    lastCardEditClick = null;
    if (editArea === 'title') {
      beginLedgerCardTitleEdit(editedCard);
      return;
    }
    if (editArea === 'body') {
      beginLedgerCardDescriptionEdit(editedCard);
      return;
    }
  }
  event.preventDefault();
  const resizeHandle = rawTarget.closest('.resize-handle') as HTMLElement | null;
  const target = rawTarget.closest('[data-card-id],[data-zone-id],[data-group-id]') as HTMLElement | null;
  const targetKind = target?.dataset.cardId ? 'card' : target?.dataset.groupId ? 'group' : target?.dataset.zoneId ? 'zone' : 'canvas';
  const targetId = target?.dataset.cardId ?? target?.dataset.groupId ?? target?.dataset.zoneId ?? '';
  const pointer = point(event);
  const canvasPointer = canvasPoint(pointer);
  const intent = derivePointerIntent(event, targetKind, resizeHandle);
  state.pointer = { intent, resizeHandle, target, targetKind, targetId, start: pointer, current: pointer, startCanvas: canvasPointer, currentCanvas: canvasPointer, startedAt: now, ctrlPan: event.ctrlKey };
  telemetry('canvas-pointer-down', { intent, targetKind, targetId, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey });
  telemetry('derive-gesture-intent', { kind: intent });
  if (intent === 'pan' && targetKind === 'canvas' && !event.ctrlKey) {
    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
    selectThread('');
    if (state.threadPanelOpen || state.activeTool === 'thread') closeThreadPanel();
    (document.activeElement as HTMLElement | null)?.blur?.();
    telemetry('clear-transient-selection', { reason: 'canvas-background-pointer-down' });
    renderSelectionState();
  }
  const preserveSelection = shouldPreservePointerSelection(state.selection, targetKind, targetId, event.shiftKey);
  if ((intent === 'drag' || intent === 'group') && !preserveSelection) selectTarget(targetKind, targetId, event.shiftKey);
  if (intent === 'resize') selectTarget(targetKind, targetId, false);
  if (intent === 'marquee' || intent === 'draw-card' || intent === 'draw-zone' || intent === 'draw-group') {
    const marquee = document.querySelector('.marquee') as HTMLElement;
    marquee.hidden = false;
    patchBox(marquee, canvasPointer.x, canvasPointer.y, 0, 0);
  }
  canvas.setPointerCapture?.(event.pointerId);
}
