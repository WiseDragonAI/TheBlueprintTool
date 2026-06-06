/**
 * WHAT: Starts the fade-out for one low-detail branch and removes it after the opacity window.
 * WHY: Leaving low-detail must tear down the survivor branch instead of preserving detail-exposed nodes.
 */
import { LOW_DETAIL_MOUNT_OPACITY_MS } from './constants.js';
import { markLedgerCardLowDetailMounted } from './mark-ledger-card-low-detail-mounted.js';

export function beginUnmountLedgerCardLowDetail(card: HTMLElement): void {
  const host = card.querySelector('.ledger-card-overview-host') as HTMLElement | null;
  if (!host || !host.querySelector('.ledger-card-overview-layer')) return;
  if (card.dataset.lowDetailMounted === 'unmounting') return;
  markLedgerCardLowDetailMounted(card, 'unmounting');
  window.setTimeout(() => {
    // Branch: Ignore stale removal callbacks after the card has already remounted low-detail or left the DOM.
    if (!card.isConnected || card.dataset.lowDetailMounted !== 'unmounting') return;
    host.replaceChildren();
    markLedgerCardLowDetailMounted(card, '');
  }, LOW_DETAIL_MOUNT_OPACITY_MS);
}
