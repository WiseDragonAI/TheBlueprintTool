/**
 * WHAT: Reconciles viewport-local ledger card detail DOM with canvas detail mode.
 * WHY: Visible cards must recover when cached detail membership diverges from mounted or revealed DOM state.
 */
import { canvas, content } from '../../dom.js';
import { state } from '../../state.js';
import { activeLedgerCardMap } from '../../ledger/helper/active-ledger-geometry.js';
import { canvasBoundsIntersect, ledgerCardBounds, viewportWorldBounds } from '../../card/helper/visible-ledger-cards.js';
import { renderLedgerCardDetailLayer } from '../../ledger/component/render-ledger-card-detail-layer.js';

const detailedCardIds = new Set<string>();

type ForcedDetailRecord = {
  cardId: string;
  hadDetail: boolean;
  wasDetailed: boolean;
  wasVisible: boolean;
};

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

function hasCompleteDetailState(cardId: string): boolean {
  const card = cardElement(cardId);
  return detailedCardIds.has(cardId)
    && Boolean(card?.classList.contains('detail-visible'))
    && Boolean(card && directChildByClass(card, 'ledger-card-detail-layer'));
}

function removeDetail(cardId: string): void {
  const card = cardElement(cardId);
  card?.classList.remove('detail-visible');
  if (card) directChildByClass(card, 'ledger-card-detail-layer')?.remove();
  detailedCardIds.delete(cardId);
}

export function clearViewportCardDetails(): void {
  for (const cardId of Array.from(detailedCardIds)) removeDetail(cardId);
  content.querySelectorAll(':scope > .card.detail-visible, :scope > .card > .ledger-card-detail-layer').forEach((node) => {
    if (node.classList.contains('detail-visible')) (node as HTMLElement).classList.remove('detail-visible');
    else node.remove();
  });
  detailedCardIds.clear();
}

function addDetail(cardId: string, ledgerCard: Record<string, unknown>, options: { reveal?: 'next-frame' | 'immediate' } = {}): void {
  const card = cardElement(cardId);
  if (!card) return;
  if (!directChildByClass(card, 'ledger-card-detail-layer')) {
    const overview = directChildByClass(card, 'ledger-card-overview-layer');
    const detailLayer = renderLedgerCardDetailLayer(ledgerCard);
    if (overview) card.insertBefore(detailLayer, overview);
    else card.append(detailLayer);
  }
  detailedCardIds.add(cardId);
  if (options.reveal === 'immediate') {
    card.classList.add('detail-visible');
    return;
  }
  nextFrame(() => {
    if (!detailedCardIds.has(cardId) || canvas.classList.contains('low-detail')) return;
    cardElement(cardId)?.classList.add('detail-visible');
  });
}

export function forceCardDetailsForMeasurement(cardIds: Iterable<string>): () => void {
  const ledgerCards = activeLedgerCardMap();
  const forced: ForcedDetailRecord[] = [];

  for (const cardId of Array.from(new Set(cardIds)).filter(Boolean)) {
    const card = cardElement(cardId);
    const ledgerCard = ledgerCards.get(cardId);
    if (!card || !ledgerCard) continue;
    forced.push({
      cardId,
      hadDetail: Boolean(directChildByClass(card, 'ledger-card-detail-layer')),
      wasDetailed: detailedCardIds.has(cardId),
      wasVisible: card.classList.contains('detail-visible')
    });
    addDetail(cardId, ledgerCard, { reveal: 'immediate' });
  }

  return () => {
    for (const detail of forced) {
      const card = cardElement(detail.cardId);
      if (!card) {
        if (!detail.wasDetailed) detailedCardIds.delete(detail.cardId);
        continue;
      }
      if (detail.wasVisible) card.classList.add('detail-visible');
      else card.classList.remove('detail-visible');
      if (!detail.hadDetail) directChildByClass(card, 'ledger-card-detail-layer')?.remove();
      if (!detail.wasDetailed) detailedCardIds.delete(detail.cardId);
    }
    syncViewportCardDetails();
  };
}

export function syncViewportCardDetails(): void {
  if (state.canvasMode === 'ledgers') {
    clearViewportCardDetails();
    return;
  }
  if (canvas.classList.contains('low-detail')) {
    clearViewportCardDetails();
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
    // WHAT: Repair every incomplete visible-card detail state, including an already tracked card.
    // WHY: Cache membership alone cannot prove that the detail subtree is mounted and revealed.
    if (ledgerCard && !hasCompleteDetailState(cardId)) addDetail(cardId, ledgerCard);
  }
}
