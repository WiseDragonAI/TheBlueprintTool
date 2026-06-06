/**
 * WHAT: Collects the ledger card ids whose world bounds intersect the current detail mount work window.
 * WHY: Mount decisions must come from ledger geometry rather than from browser layout state.
 */
import { canvasBoundsIntersect, ledgerCardBounds, type CanvasBounds } from '../helper/visible-ledger-cards.js';

export function collectDetailMountedCardIds(cards: Array<Record<string, unknown>>, bounds: CanvasBounds): Set<string> {
  const ids = new Set<string>();
  for (const card of cards) {
    const id = String(card.id ?? '');
    // Branch: Skip ledger entries without a stable runtime card id.
    if (!id) continue;
    // Branch: Only cards intersecting the padded work window keep heavy detail mounted.
    if (canvasBoundsIntersect(ledgerCardBounds(card), bounds)) ids.add(id);
  }
  return ids;
}
