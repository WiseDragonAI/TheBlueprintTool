/**
 * WHAT: Moves one explicit selection through ledger geometry or static DOM geometry.
 * WHY: Active gestures must keep using their pointer-down selection across refresh and live selection changes.
 */
import { state, type SelectionState } from '../../state.js';
import { cloneSelectionState } from '../helper/clone-selection-state.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { activeLedgerAnnotationMap, activeLedgerCardMap, ledgerAnnotationGeometry, ledgerCardGeometry, patchLedgerAnnotationGeometry, patchLedgerCardGeometry } from '../../ledger/helper/active-ledger-geometry.js';
import { renderGeometry } from '../../canvas/helper/render-density.js';

export function moveSelected(dx: number, dy: number, selection: Partial<SelectionState> = state.selection): void {
  const movingSelection = cloneSelectionState(selection);
  // WHAT: Patch the authoritative ledger when present; otherwise update static canvas nodes.
  // WHY: Both canvas modes share gesture control flow but own geometry in different stores.
  if (state.activeLedger) {
    moveSelectedLedgerGeometry(dx, dy, movingSelection);
  } else {
    moveSelectedDomGeometry(dx, dy, movingSelection);
  }
  telemetry('render-card-layer', { moved: movingSelection.cardIds });
  telemetry('render-zone-layer', { moved: movingSelection.zoneIds });
  telemetry('render-group-layer', { moved: movingSelection.groupIds });
  renderZoneLabelOverlay();
  renderRelationshipOverlay();
  renderCanvasControlOverlay(movingSelection);
}

function moveSelectedLedgerGeometry(dx: number, dy: number, selection: SelectionState): void {
  const cards = activeLedgerCardMap();
  const annotations = activeLedgerAnnotationMap();
  for (const id of selection.cardIds) {
    const card = cards.get(id);
    if (!card) continue;
    const geometry = ledgerCardGeometry(card);
    patchLedgerCardGeometry(card, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
    patchNodePosition(document.querySelector(`[data-card-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
  }
  for (const id of selection.zoneIds) {
    const annotation = annotations.get(id);
    if (!annotation) continue;
    const geometry = ledgerAnnotationGeometry(annotation);
    patchLedgerAnnotationGeometry(annotation, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
    patchNodePosition(document.querySelector(`[data-zone-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
  }
  for (const id of selection.groupIds) {
    const annotation = annotations.get(id);
    if (!annotation) continue;
    const geometry = ledgerAnnotationGeometry(annotation);
    patchLedgerAnnotationGeometry(annotation, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
    patchNodePosition(document.querySelector(`[data-group-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
  }
}

function moveSelectedDomGeometry(dx: number, dy: number, selection: SelectionState): void {
  const selected = [
    ...selection.cardIds.map((id: string) => document.querySelector(`[data-card-id="${id}"]`)),
    ...selection.zoneIds.map((id: string) => document.querySelector(`[data-zone-id="${id}"]`)),
    ...selection.groupIds.map((id: string) => document.querySelector(`[data-group-id="${id}"]`))
  ].filter(Boolean) as HTMLElement[];
  selected.forEach((node) => {
    node.style.left = `${node.offsetLeft + dx}px`;
    node.style.top = `${node.offsetTop + dy}px`;
  });
}

function patchNodePosition(node: HTMLElement | null, x: number, y: number): void {
  if (!node) return;
  const renderedGeometry = renderGeometry({ x, y, width: 0, height: 0 });
  node.style.left = `${renderedGeometry.x}px`;
  node.style.top = `${renderedGeometry.y}px`;
}
