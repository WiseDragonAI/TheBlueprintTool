/**
 * WHAT: Mounts a fresh low-detail branch for every ledger card in the active surface.
 * WHY: Low-detail is a global presentation mode, so every visible card shell needs a rebuilt low-detail branch on entry.
 */
import { content } from '../../dom.js';
import { activeLedgerCardMap } from '../../ledger/helper/active-ledger-geometry.js';
import { mountLedgerCardLowDetail } from './mount-ledger-card-low-detail.js';

export function mountAllLedgerCardLowDetail(): void {
  const ledgerCards = activeLedgerCardMap();
  for (const card of content.querySelectorAll<HTMLElement>('.card[data-card-id]')) {
    const id = card.dataset.cardId ?? '';
    if (!id) continue;
    // Branch: Only cards that still exist in the active ledger should rebuild a low-detail branch.
    mountLedgerCardLowDetail(card, ledgerCards.get(id));
  }
}
