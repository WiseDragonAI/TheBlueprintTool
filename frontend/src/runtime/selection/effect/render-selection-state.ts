import { state } from '../../state.js';
import { connectedCardIds } from '../../relationship/helper/connected-card-ids.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';

export function renderSelectionState(): void {
  const connectedIds = connectedCardIds(state.selection.cardIds);
  document.querySelectorAll('[data-card-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', state.selection.cardIds.includes(element.dataset.cardId));
    element.classList.toggle('connected', connectedIds.includes(element.dataset.cardId ?? ''));
  });
  document.querySelectorAll('[data-zone-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', state.selection.zoneIds.includes(element.dataset.zoneId));
  });
  document.querySelectorAll('[data-group-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', state.selection.groupIds.includes(element.dataset.groupId));
  });
  renderCanvasControlOverlay();
}
