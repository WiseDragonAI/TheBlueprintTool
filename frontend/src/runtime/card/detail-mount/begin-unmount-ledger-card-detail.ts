/**
 * WHAT: Starts the fade-out for one mounted card detail subtree and removes it after the opacity window.
 * WHY: Detail eviction must preserve the existing visual transition instead of dropping heavy content abruptly.
 */
import { DETAIL_MOUNT_OPACITY_MS } from './constants.js';
import { markLedgerCardDetailMounted } from './mark-ledger-card-detail-mounted.js';
import { detailMountState } from './state.js';

export function beginUnmountLedgerCardDetail(card: HTMLElement): void {
  const id = card.dataset.cardId ?? '';
  const host = card.querySelector('.ledger-card-detail-host') as HTMLElement | null;
  // Branch: Cards without a mounted detail subtree have nothing to fade out or remove.
  if (!id || !host || !host.querySelector('.ledger-card-detail-layer')) return;
  // Branch: Preserve the active fade-out instead of restarting the same unmount transition.
  if (card.dataset.detailMounted === 'unmounting') return;
  const existingTimer = detailMountState.unmountTimers.get(id);
  // Branch: Replace any earlier removal timer so only the latest unmount edge owns teardown.
  if (existingTimer) window.clearTimeout(existingTimer);
  markLedgerCardDetailMounted(card, 'unmounting');
  const timer = window.setTimeout(() => {
    detailMountState.unmountTimers.delete(id);
    // Branch: Ignore stale removal callbacks after remount or card teardown.
    if (!card.isConnected || card.dataset.detailMounted !== 'unmounting') return;
    host.replaceChildren();
    markLedgerCardDetailMounted(card, '');
  }, DETAIL_MOUNT_OPACITY_MS);
  detailMountState.unmountTimers.set(id, timer);
}
