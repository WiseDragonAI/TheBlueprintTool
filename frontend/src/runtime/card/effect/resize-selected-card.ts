/**
 * WHAT: Applies pointer resize deltas to the selected card and its active-ledger geometry.
 * WHY: Resizing must survive canvas remounts by resolving the live node from pointer identity.
 */
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { activeLedgerCardMap, ledgerCardGeometry, patchLedgerCardGeometry, type LedgerGeometry } from '../../ledger/helper/active-ledger-geometry.js';
import { renderGeometry } from '../../canvas/helper/render-density.js';
import { resolveCurrentPointerTarget } from '../../gesture/helper/resolve-current-pointer-target.js';

export function resizeSelectedCard(dx: number, dy: number): void {
  const pointer = state.pointer;
  const savedCard = pointer?.target as HTMLElement | null;
  const cardId = String(pointer?.targetId || savedCard?.dataset.cardId || '');
  const card = resolveCurrentPointerTarget('card', cardId, savedCard);
  const ledgerCard = state.activeLedger && cardId ? activeLedgerCardMap().get(cardId) : undefined;
  // WHAT: Stop only when neither persisted geometry nor a live target remains.
  // WHY: A remounted canvas can invalidate either representation independently.
  if (!card && !ledgerCard) return;
  const current = ledgerCard
    ? ledgerCardGeometry(ledgerCard)
    : { x: card?.offsetLeft ?? 0, y: card?.offsetTop ?? 0, width: card?.offsetWidth ?? 0, height: card?.offsetHeight ?? 0 };
  const handle = pointer?.resizeHandle as HTMLElement | null;
  const west = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('sw'));
  const east = Boolean(handle?.classList.contains('ne') || handle?.classList.contains('se'));
  const north = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('ne'));
  const south = Boolean(handle?.classList.contains('sw') || handle?.classList.contains('se'));
  const minWidth = 220;
  const minHeight = 132;
  let nextLeft = current.x;
  let nextTop = current.y;
  let nextWidth = current.width;
  let nextHeight = current.height;
  // WHAT: Clamp west and north movement while preserving the opposite edge.
  // WHY: Resizing must honor the card minimum without shifting the anchored edge.
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
  if (ledgerCard) patchLedgerCardGeometry(ledgerCard, geometry);
  if (card) patchCardBox(card, geometry);
  renderRelationshipOverlay();
  renderCanvasControlOverlay();
  telemetry('render-card-layer', { spec: '60000006', resized: cardId, geometry });
}

function patchCardBox(card: HTMLElement, geometry: LedgerGeometry): void {
  const renderedGeometry = state.activeLedger ? renderGeometry(geometry) : geometry;
  card.style.left = `${renderedGeometry.x}px`;
  card.style.top = `${renderedGeometry.y}px`;
  card.style.width = `${renderedGeometry.width}px`;
  card.style.height = `${renderedGeometry.height}px`;
  card.style.minHeight = `${renderedGeometry.height}px`;
  card.dataset.sizeCacheWidth = String(geometry.width);
  card.dataset.sizeCacheHeight = String(geometry.height);
  card.style.setProperty('--card-size-cache-width', `${geometry.width}px`);
  card.style.setProperty('--card-size-cache-height', `${geometry.height}px`);
}
