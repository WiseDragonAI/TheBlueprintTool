import { canvas, content } from '../../dom.js';
import { state } from '../../state.js';
import { activeLedgerCardMap } from '../../ledger/helper/active-ledger-geometry.js';
import { canvasBoundsIntersect, ledgerCardBounds, viewportWorldBounds } from '../../card/helper/visible-ledger-cards.js';
import { renderLedgerCardDetailLayer } from '../../ledger/component/render-ledger-card-detail-layer.js';

const detailedCardIds = new Set<string>();

function nextFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback);
  else setTimeout(callback, 0);
}

function viewportCanvasSize(): { width: number; height: number } {
  return {
    width: window.innerWidth || document.documentElement.clientWidth || 0,
    height: window.innerHeight || document.documentElement.clientHeight || 0
  };
}

function cardElement(cardId: string): HTMLElement | null {
  return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(cardId)}"]`) as HTMLElement | null;
}

function directChildByClass(element: HTMLElement, className: string): HTMLElement | null {
  for (const child of Array.from(element.children) as HTMLElement[]) {
    if (child.className.split(/\s+/).includes(className)) return child;
  }
  return null;
}

function removeDetail(cardId: string): void {
  const card = cardElement(cardId);
  card?.classList.remove('detail-visible');
  if (card) directChildByClass(card, 'ledger-card-detail-layer')?.remove();
  detailedCardIds.delete(cardId);
}

function addDetail(cardId: string, ledgerCard: Record<string, unknown>): void {
  const card = cardElement(cardId);
  if (!card) return;
  if (!directChildByClass(card, 'ledger-card-detail-layer')) {
    const overview = directChildByClass(card, 'ledger-card-overview-layer');
    const detailLayer = renderLedgerCardDetailLayer(ledgerCard);
    if (overview) card.insertBefore(detailLayer, overview);
    else card.append(detailLayer);
  }
  detailedCardIds.add(cardId);
  nextFrame(() => {
    if (!detailedCardIds.has(cardId) || canvas.classList.contains('low-detail')) return;
    cardElement(cardId)?.classList.add('detail-visible');
  });
}

export function syncViewportCardDetails(): void {
  if (canvas.classList.contains('low-detail')) {
    for (const cardId of Array.from(detailedCardIds)) removeDetail(cardId);
    return;
  }

  const ledgerCards = activeLedgerCardMap();
  const bounds = viewportWorldBounds(state.viewport, viewportCanvasSize());
  const nextDetailedCardIds = new Set<string>();
  for (const [cardId, ledgerCard] of ledgerCards) {
    if (canvasBoundsIntersect(ledgerCardBounds(ledgerCard), bounds)) nextDetailedCardIds.add(cardId);
  }
  for (const cardId of Array.from(detailedCardIds)) {
    if (!nextDetailedCardIds.has(cardId)) removeDetail(cardId);
  }
  for (const cardId of nextDetailedCardIds) {
    const ledgerCard = ledgerCards.get(cardId);
    if (ledgerCard && !detailedCardIds.has(cardId)) addDetail(cardId, ledgerCard);
  }
}
