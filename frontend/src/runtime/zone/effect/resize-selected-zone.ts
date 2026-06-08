import { state } from '../../state.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { renderZoneLabelOverlay } from './render-zone-label-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { activeLedgerAnnotationMap, ledgerAnnotationGeometry, patchLedgerAnnotationGeometry, type LedgerGeometry } from '../../ledger/helper/active-ledger-geometry.js';
import { renderGeometry } from '../../canvas/helper/render-density.js';

export function resizeSelectedZone(dx: number, dy: number): void {
  const zone = state.pointer?.target as HTMLElement | null;
  if (!zone) return;
  const id = zone.dataset.zoneId ?? zone.dataset.groupId ?? '';
  const ledgerAnnotation = state.activeLedger && id ? activeLedgerAnnotationMap().get(id) : undefined;
  const current = ledgerAnnotation
    ? ledgerAnnotationGeometry(ledgerAnnotation)
    : { x: zone.offsetLeft, y: zone.offsetTop, width: zone.offsetWidth, height: zone.offsetHeight };
  const handle = state.pointer.resizeHandle as HTMLElement | null;
  const west = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('sw'));
  const east = Boolean(handle?.classList.contains('ne') || handle?.classList.contains('se'));
  const north = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('ne'));
  const south = Boolean(handle?.classList.contains('sw') || handle?.classList.contains('se'));
  const minWidth = zone.dataset.groupId ? 220 : 180;
  const minHeight = zone.dataset.groupId ? 160 : 140;
  let nextLeft = current.x;
  let nextTop = current.y;
  let nextWidth = current.width;
  let nextHeight = current.height;
  if (west) {
    const clampedDx = Math.min(dx, current.width - minWidth);
    nextLeft = current.x + clampedDx;
    nextWidth = current.width - clampedDx;
  }
  if (east) nextWidth = Math.max(minWidth, current.width + dx);
  if (north) {
    const clampedDy = Math.min(dy, current.height - minHeight);
    nextTop = current.y + clampedDy;
    nextHeight = current.height - clampedDy;
  }
  if (south) nextHeight = Math.max(minHeight, current.height + dy);
  const geometry = { x: nextLeft, y: nextTop, width: nextWidth, height: nextHeight };
  if (ledgerAnnotation) patchLedgerAnnotationGeometry(ledgerAnnotation, geometry);
  patchZoneBox(zone, geometry);
  renderZoneLabelOverlay();
  renderCanvasControlOverlay();
  telemetry(zone.dataset.groupId ? 'render-group-layer' : 'render-zone-layer', { resized: id, geometry });
}

function patchZoneBox(zone: HTMLElement, geometry: LedgerGeometry): void {
  const renderedGeometry = state.activeLedger ? renderGeometry(geometry) : geometry;
  zone.style.left = `${renderedGeometry.x}px`;
  zone.style.top = `${renderedGeometry.y}px`;
  zone.style.width = `${renderedGeometry.width}px`;
  zone.style.height = `${renderedGeometry.height}px`;
  zone.style.minHeight = `${renderedGeometry.height}px`;
}
