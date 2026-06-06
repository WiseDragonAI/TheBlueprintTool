/**
 * WHAT: Cancels pending mount work and evicts all mounted card detail subtrees.
 * WHY: Low-detail mode should never retain heavy detail DOM from an earlier zoom state.
 */
import { content } from '../../dom.js';
import { detailMountState } from './state.js';
import { beginUnmountLedgerCardDetail } from './begin-unmount-ledger-card-detail.js';

export function clearMountedLedgerCardDetails(): void {
  // Branch: Cancel any pending settled sync because low-detail should not remount heavy detail afterward.
  if (detailMountState.settleTimer) {
    window.clearTimeout(detailMountState.settleTimer);
    detailMountState.settleTimer = 0;
  }
  // Branch: Cancel queued RAF mount work for the same low-detail edge.
  if (detailMountState.mountFrame) {
    cancelAnimationFrame(detailMountState.mountFrame);
    detailMountState.mountFrame = 0;
  }
  for (const card of content.querySelectorAll<HTMLElement>('.card[data-card-id]')) {
    beginUnmountLedgerCardDetail(card);
  }
}
