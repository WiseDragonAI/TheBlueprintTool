import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function resizeSelectedCard(dx: number, dy: number): void {
  const card = state.pointer?.target as HTMLElement | null;
  if (!card) return;
  const handle = state.pointer.resizeHandle as HTMLElement | null;
  const west = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('sw'));
  const east = Boolean(handle?.classList.contains('ne') || handle?.classList.contains('se'));
  const north = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('ne'));
  const south = Boolean(handle?.classList.contains('sw') || handle?.classList.contains('se'));
  const minWidth = 220;
  const minHeight = 132;
  let nextLeft = card.offsetLeft;
  let nextTop = card.offsetTop;
  let nextWidth = card.offsetWidth;
  let nextHeight = card.offsetHeight;
  if (west) {
    const clampedDx = Math.min(dx, card.offsetWidth - minWidth);
    nextLeft = card.offsetLeft + clampedDx;
    nextWidth = card.offsetWidth - clampedDx;
  }
  if (east) nextWidth = Math.max(minWidth, card.offsetWidth + dx);
  if (north) {
    const clampedDy = Math.min(dy, card.offsetHeight - minHeight);
    nextTop = card.offsetTop + clampedDy;
    nextHeight = card.offsetHeight - clampedDy;
  }
  if (south) nextHeight = Math.max(minHeight, card.offsetHeight + dy);
  card.style.left = `${nextLeft}px`;
  card.style.top = `${nextTop}px`;
  card.style.width = `${nextWidth}px`;
  card.style.height = `${nextHeight}px`;
  card.dataset.sizeCacheWidth = String(nextWidth);
  card.dataset.sizeCacheHeight = String(nextHeight);
  card.style.setProperty('--card-size-cache-width', `${nextWidth}px`);
  card.style.setProperty('--card-size-cache-height', `${nextHeight}px`);
  renderRelationshipOverlay();
  renderCanvasControlOverlay();
  telemetry('render-card-layer', { spec: '60000006', resized: card.dataset.cardId, geometry: card.getBoundingClientRect().toJSON?.() });
}
