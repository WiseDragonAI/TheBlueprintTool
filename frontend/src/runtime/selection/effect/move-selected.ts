import { state } from '../../state.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { activeLedgerAnnotationMap, activeLedgerCardMap, ledgerAnnotationGeometry, ledgerCardGeometry, patchLedgerAnnotationGeometry, patchLedgerCardGeometry } from '../../ledger/helper/active-ledger-geometry.js';
import { renderGeometry } from '../../canvas/helper/render-density.js';

export function moveSelected(dx: number, dy: number): void {
  if (state.activeLedger) {
    moveSelectedLedgerGeometry(dx, dy);
  } else {
    moveSelectedDomGeometry(dx, dy);
  }
  telemetry('render-card-layer', { moved: state.selection.cardIds });
  telemetry('render-zone-layer', { moved: state.selection.zoneIds });
  telemetry('render-group-layer', { moved: state.selection.groupIds });
  renderZoneLabelOverlay();
  renderRelationshipOverlay();
  renderCanvasControlOverlay();
}

function moveSelectedLedgerGeometry(dx: number, dy: number): void {
  const cards = activeLedgerCardMap();
  const annotations = activeLedgerAnnotationMap();
  for (const id of state.selection.cardIds as string[]) {
    const card = cards.get(id);
    if (!card) continue;
    const geometry = ledgerCardGeometry(card);
    patchLedgerCardGeometry(card, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
    patchNodePosition(document.querySelector(`[data-card-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
  }
  for (const id of state.selection.zoneIds as string[]) {
    const annotation = annotations.get(id);
    if (!annotation) continue;
    const geometry = ledgerAnnotationGeometry(annotation);
    patchLedgerAnnotationGeometry(annotation, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
    patchNodePosition(document.querySelector(`[data-zone-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
  }
  for (const id of state.selection.groupIds as string[]) {
    const annotation = annotations.get(id);
    if (!annotation) continue;
    const geometry = ledgerAnnotationGeometry(annotation);
    patchLedgerAnnotationGeometry(annotation, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
    patchNodePosition(document.querySelector(`[data-group-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
  }
}

function moveSelectedDomGeometry(dx: number, dy: number): void {
  const selected = [
    ...state.selection.cardIds.map((id: string) => document.querySelector(`[data-card-id="${id}"]`)),
    ...state.selection.zoneIds.map((id: string) => document.querySelector(`[data-zone-id="${id}"]`)),
    ...state.selection.groupIds.map((id: string) => document.querySelector(`[data-group-id="${id}"]`))
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
