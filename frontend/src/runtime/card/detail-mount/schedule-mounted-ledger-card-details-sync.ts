/**
 * WHAT: Debounces viewport-driven card detail reconciliation to the post-input settle edge.
 * WHY: Pan and wheel churn should stay transform-only while the heavy detail working set updates once per burst.
 */
import { canvas } from '../../dom.js';
import { DETAIL_MOUNT_SETTLE_MS } from './constants.js';
import { detailMountState } from './state.js';
import { syncMountedLedgerCardDetails } from './sync-mounted-ledger-card-details.js';

export function scheduleMountedLedgerCardDetailsSync(immediate = false): void {
  // Branch: Low-detail owns a zero-detail steady state, so viewport churn must not queue remount work.
  if (canvas.classList.contains('low-detail')) return;
  // Branch: Replace the previous settle timer so only the latest viewport burst triggers reconciliation.
  if (detailMountState.settleTimer) window.clearTimeout(detailMountState.settleTimer);
  // Branch: Replace any previously queued immediate frame with the newest request.
  if (detailMountState.mountFrame) cancelAnimationFrame(detailMountState.mountFrame);
  // Branch: Immediate edges use RAF so the latest world transform paints before detail mount work begins.
  if (immediate) {
    detailMountState.mountFrame = requestAnimationFrame(() => {
      detailMountState.mountFrame = 0;
      syncMountedLedgerCardDetails();
    });
    return;
  }
  detailMountState.settleTimer = window.setTimeout(() => {
    detailMountState.settleTimer = 0;
    syncMountedLedgerCardDetails();
  }, DETAIL_MOUNT_SETTLE_MS);
}
