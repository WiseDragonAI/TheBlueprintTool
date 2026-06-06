import { state } from '../../state.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { activeLedgerAnnotationMap, activeLedgerCardMap, ledgerAnnotationGeometry, ledgerCardGeometry, patchLedgerAnnotationGeometry, patchLedgerCardGeometry } from '../../ledger/helper/active-ledger-geometry.js';
import { dragTraceHook } from '../../performance/drag-trace-span.js';

export function moveSelected(dx: number, dy: number): void {
  const span = dragTraceHook();
  if (!span) {
    moveSelectedBody(dx, dy);
    return;
  }
  span('moveSelected', () => moveSelectedBody(dx, dy, span));
}

function moveSelectedBody(dx: number, dy: number, span?: NonNullable<ReturnType<typeof dragTraceHook>>): void {
    if (state.activeLedger) {
      if (span) span('moveSelected:moveSelectedLedgerGeometry', () => moveSelectedLedgerGeometry(dx, dy, span));
      else moveSelectedLedgerGeometry(dx, dy);
    } else {
      if (span) span('moveSelected:moveSelectedDomGeometry', () => moveSelectedDomGeometry(dx, dy, span));
      else moveSelectedDomGeometry(dx, dy);
    }
    const emitTelemetry = () => {
      telemetry('render-card-layer', { moved: state.selection.cardIds });
      telemetry('render-zone-layer', { moved: state.selection.zoneIds });
      telemetry('render-group-layer', { moved: state.selection.groupIds });
    };
    if (span) span('moveSelected:telemetry', emitTelemetry);
    else emitTelemetry();
    if (span) span('moveSelected:renderZoneLabelOverlay', () => renderZoneLabelOverlay());
    else renderZoneLabelOverlay();
    if (span) span('moveSelected:renderRelationshipOverlay', () => renderRelationshipOverlay());
    else renderRelationshipOverlay();
    if (span) span('moveSelected:renderCanvasControlOverlay', () => renderCanvasControlOverlay());
    else renderCanvasControlOverlay();
}

function moveSelectedLedgerGeometry(dx: number, dy: number, span?: NonNullable<ReturnType<typeof dragTraceHook>>): void {
  const cards = span ? span('moveSelectedLedgerGeometry:activeLedgerCardMap', () => activeLedgerCardMap()) : activeLedgerCardMap();
  const annotations = span ? span('moveSelectedLedgerGeometry:activeLedgerAnnotationMap', () => activeLedgerAnnotationMap()) : activeLedgerAnnotationMap();
  for (const id of state.selection.cardIds as string[]) {
    const card = cards.get(id);
    if (!card) continue;
    const geometry = span ? span('moveSelectedLedgerGeometry:ledgerCardGeometry', () => ledgerCardGeometry(card)) : ledgerCardGeometry(card);
    if (span) span('moveSelectedLedgerGeometry:patchLedgerCardGeometry', () => patchLedgerCardGeometry(card, { ...geometry, x: geometry.x + dx, y: geometry.y + dy }));
    else patchLedgerCardGeometry(card, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
    const node = span ? span('moveSelectedLedgerGeometry:queryCardNode', () => document.querySelector(`[data-card-id="${CSS.escape(id)}"]`) as HTMLElement | null) : document.querySelector(`[data-card-id="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (span) span('moveSelectedLedgerGeometry:patchNodePosition:card', () => patchNodePosition(node, geometry.x + dx, geometry.y + dy));
    else patchNodePosition(node, geometry.x + dx, geometry.y + dy);
  }
  for (const id of state.selection.zoneIds as string[]) {
    const annotation = annotations.get(id);
    if (!annotation) continue;
    const geometry = span ? span('moveSelectedLedgerGeometry:ledgerAnnotationGeometry:zone', () => ledgerAnnotationGeometry(annotation)) : ledgerAnnotationGeometry(annotation);
    if (span) span('moveSelectedLedgerGeometry:patchLedgerAnnotationGeometry:zone', () => patchLedgerAnnotationGeometry(annotation, { ...geometry, x: geometry.x + dx, y: geometry.y + dy }));
    else patchLedgerAnnotationGeometry(annotation, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
    const node = span ? span('moveSelectedLedgerGeometry:queryZoneNode', () => document.querySelector(`[data-zone-id="${CSS.escape(id)}"]`) as HTMLElement | null) : document.querySelector(`[data-zone-id="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (span) span('moveSelectedLedgerGeometry:patchNodePosition:zone', () => patchNodePosition(node, geometry.x + dx, geometry.y + dy));
    else patchNodePosition(node, geometry.x + dx, geometry.y + dy);
  }
  for (const id of state.selection.groupIds as string[]) {
    const annotation = annotations.get(id);
    if (!annotation) continue;
    const geometry = span ? span('moveSelectedLedgerGeometry:ledgerAnnotationGeometry:group', () => ledgerAnnotationGeometry(annotation)) : ledgerAnnotationGeometry(annotation);
    if (span) span('moveSelectedLedgerGeometry:patchLedgerAnnotationGeometry:group', () => patchLedgerAnnotationGeometry(annotation, { ...geometry, x: geometry.x + dx, y: geometry.y + dy }));
    else patchLedgerAnnotationGeometry(annotation, { ...geometry, x: geometry.x + dx, y: geometry.y + dy });
    const node = span ? span('moveSelectedLedgerGeometry:queryGroupNode', () => document.querySelector(`[data-group-id="${CSS.escape(id)}"]`) as HTMLElement | null) : document.querySelector(`[data-group-id="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (span) span('moveSelectedLedgerGeometry:patchNodePosition:group', () => patchNodePosition(node, geometry.x + dx, geometry.y + dy));
    else patchNodePosition(node, geometry.x + dx, geometry.y + dy);
  }
}

function moveSelectedDomGeometry(dx: number, dy: number, span?: NonNullable<ReturnType<typeof dragTraceHook>>): void {
  const querySelected = () => [
    ...state.selection.cardIds.map((id: string) => document.querySelector(`[data-card-id="${id}"]`)),
    ...state.selection.zoneIds.map((id: string) => document.querySelector(`[data-zone-id="${id}"]`)),
    ...state.selection.groupIds.map((id: string) => document.querySelector(`[data-group-id="${id}"]`))
  ].filter(Boolean) as HTMLElement[];
  const selected = span ? span('moveSelectedDomGeometry:querySelectedNodes', querySelected) : querySelected();
  selected.forEach((node) => {
    const patch = () => {
      node.style.left = `${node.offsetLeft + dx}px`;
      node.style.top = `${node.offsetTop + dy}px`;
    };
    if (span) span('moveSelectedDomGeometry:patchNodePositionFromOffset', patch);
    else patch();
  });
}

function patchNodePosition(node: HTMLElement | null, x: number, y: number): void {
  if (!node) return;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
}
