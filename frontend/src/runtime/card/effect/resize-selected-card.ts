import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { activeLedgerCardMap, ledgerCardGeometry, patchLedgerCardGeometry, type LedgerGeometry } from '../../ledger/helper/active-ledger-geometry.js';

export function resizeSelectedCard(dx: number, dy: number): void {
  const card = state.pointer?.target as HTMLElement | null;
  if (!card) return;
  const current = state.activeLedger && card.dataset.cardId
    ? ledgerCardGeometry(activeLedgerCardMap().get(card.dataset.cardId) ?? {})
    : { x: card.offsetLeft, y: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight };
  const handle = state.pointer.resizeHandle as HTMLElement | null;
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
  if (state.activeLedger && card.dataset.cardId) {
    const ledgerCard = activeLedgerCardMap().get(card.dataset.cardId);
    if (ledgerCard) patchLedgerCardGeometry(ledgerCard, geometry);
  }
  patchCardBox(card, geometry);
  renderRelationshipOverlay();
  renderCanvasControlOverlay();
  telemetry('render-card-layer', { spec: '60000006', resized: card.dataset.cardId, geometry });
}

function patchCardBox(card: HTMLElement, geometry: LedgerGeometry): void {
  card.style.left = `${geometry.x}px`;
  card.style.top = `${geometry.y}px`;
  card.style.width = `${geometry.width}px`;
  card.style.height = `${geometry.height}px`;
  card.dataset.sizeCacheWidth = String(geometry.width);
  card.dataset.sizeCacheHeight = String(geometry.height);
  card.style.setProperty('--card-size-cache-width', `${geometry.width}px`);
  card.style.setProperty('--card-size-cache-height', `${geometry.height}px`);
}
