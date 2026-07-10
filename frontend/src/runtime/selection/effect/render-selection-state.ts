/**
 * WHAT: Renders visible selection, relationship emphasis, and optional canvas controls.
 * WHY: Accepted reconciliation and direct interaction must leave DOM selection synchronized with live state.
 */
import { state } from '../../state.js';
import { connectedCardIds } from '../../relationship/helper/connected-card-ids.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';

export function renderSelectionState(options: { renderControls?: boolean } = {}): void {
  // Visible chrome always follows live selection; pointer snapshots are gesture-only operands.
  const visibleSelection = state.selection;
  const connectedIds = connectedCardIds(visibleSelection.cardIds);
  document.querySelectorAll('[data-card-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', visibleSelection.cardIds.includes(element.dataset.cardId));
    element.classList.toggle('connected', connectedIds.includes(element.dataset.cardId ?? ''));
  });
  document.querySelectorAll('[data-zone-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', visibleSelection.zoneIds.includes(element.dataset.zoneId));
  });
  document.querySelectorAll('[data-group-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', visibleSelection.groupIds.includes(element.dataset.groupId));
  });
  // WHAT: Let reconciliation repaint selection classes without remounting live controls.
  // WHY: Same-thread focus and pointer continuity must survive accepted server responses.
  if (options.renderControls !== false) renderCanvasControlOverlay();
}
