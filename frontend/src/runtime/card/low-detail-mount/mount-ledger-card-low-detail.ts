/**
 * WHAT: Mounts one fresh low-detail branch for a card and starts the opacity reveal.
 * WHY: Returning from detail must not reuse the old low-detail survivor nodes that carry poisoned raster history.
 */
import { createLedgerCardOverviewLayer } from '../../ledger/component/create-ledger-card-overview-layer.js';
import { resolveCardWorkStatus } from '../helper/resolve-card-work-status.js';
import { markLedgerCardLowDetailMounted } from './mark-ledger-card-low-detail-mounted.js';

export function mountLedgerCardLowDetail(card: HTMLElement, ledgerCard: Record<string, unknown> | null | undefined): void {
  const id = card.dataset.cardId ?? '';
  const host = card.querySelector('.ledger-card-overview-host') as HTMLElement | null;
  if (!id || !host || !ledgerCard) return;
  if (card.dataset.lowDetailMounted === 'mounted' || card.dataset.lowDetailMounted === 'mounting') return;
  host.replaceChildren(createLedgerCardOverviewLayer(ledgerCard, id, resolveCardWorkStatus(ledgerCard)));
  markLedgerCardLowDetailMounted(card, 'mounting');
  requestAnimationFrame(() => {
    // Branch: Only the latest mounted low-detail branch should complete the fade-in after the frame boundary.
    if (!card.isConnected || card.dataset.lowDetailMounted !== 'mounting') return;
    markLedgerCardLowDetailMounted(card, 'mounted');
  });
}
