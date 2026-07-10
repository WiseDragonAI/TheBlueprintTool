/**
 * WHAT: Applies pointer resize deltas to a selected zone or group and its ledger annotation.
 * WHY: Region resizing must survive canvas remounts without losing target identity or variant limits.
 */
import { state } from '../../state.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { renderZoneLabelOverlay } from './render-zone-label-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { activeLedgerAnnotationMap, ledgerAnnotationGeometry, patchLedgerAnnotationGeometry, type LedgerGeometry } from '../../ledger/helper/active-ledger-geometry.js';
import { renderGeometry } from '../../canvas/helper/render-density.js';
import { resolveCurrentPointerTarget } from '../../gesture/helper/resolve-current-pointer-target.js';

export function resizeSelectedZone(dx: number, dy: number): void {
  const pointer = state.pointer;
  const savedZone = pointer?.target as HTMLElement | null;
  const targetKind = pointer?.targetKind === 'group' ? 'group' : 'zone';
  const id = String(pointer?.targetId || savedZone?.dataset.zoneId || savedZone?.dataset.groupId || '');
  const zone = resolveCurrentPointerTarget(targetKind, id, savedZone);
  const ledgerAnnotation = state.activeLedger && id ? activeLedgerAnnotationMap().get(id) : undefined;
  // WHAT: Stop only when neither persisted annotation geometry nor a live target remains.
  // WHY: A remounted canvas can invalidate either representation independently.
  if (!zone && !ledgerAnnotation) return;
  const isGroup = targetKind === 'group' || zone?.dataset.groupId === id || ledgerAnnotation?.variant === 'group';
  const current = ledgerAnnotation
    ? ledgerAnnotationGeometry(ledgerAnnotation)
    : { x: zone?.offsetLeft ?? 0, y: zone?.offsetTop ?? 0, width: zone?.offsetWidth ?? 0, height: zone?.offsetHeight ?? 0 };
  const handle = pointer?.resizeHandle as HTMLElement | null;
  const west = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('sw'));
  const east = Boolean(handle?.classList.contains('ne') || handle?.classList.contains('se'));
  const north = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('ne'));
  const south = Boolean(handle?.classList.contains('sw') || handle?.classList.contains('se'));
  const minWidth = isGroup ? 220 : 180;
  const minHeight = isGroup ? 160 : 140;
  let nextLeft = current.x;
  let nextTop = current.y;
  let nextWidth = current.width;
  let nextHeight = current.height;
  // WHAT: Clamp west and north movement while preserving the opposite edge.
  // WHY: Region resizing must honor variant minimums without shifting the anchored edge.
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
  if (zone) patchZoneBox(zone, geometry);
  renderZoneLabelOverlay();
  renderCanvasControlOverlay();
  telemetry(isGroup ? 'render-group-layer' : 'render-zone-layer', { resized: id, geometry });
}

function patchZoneBox(zone: HTMLElement, geometry: LedgerGeometry): void {
  const renderedGeometry = state.activeLedger ? renderGeometry(geometry) : geometry;
  zone.style.left = `${renderedGeometry.x}px`;
  zone.style.top = `${renderedGeometry.y}px`;
  zone.style.width = `${renderedGeometry.width}px`;
  zone.style.height = `${renderedGeometry.height}px`;
  zone.style.minHeight = `${renderedGeometry.height}px`;
}
