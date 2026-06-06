/**
 * WHAT: Debounces staged detail reveal queueing while normal-detail zoom settles.
 * WHY: The scheduler should activate only after crossing out of low detail and then wait for input churn to stop.
 */
import { canvas } from '../../../dom.js';
import { DETAIL_REVEAL_SETTLE_MS } from './constants.js';
import { settleStagedDetailRevealQueue } from './settle-staged-detail-reveal-queue.js';
import { stagedDetailRevealState } from './state.js';

export function scheduleStagedDetailReveal(): void {
  if (!canvas.classList.contains('detail-reveal-staged')) {
    // Branch: Steady normal-detail viewport updates do not schedule reveal work.
    return;
  }
  if (stagedDetailRevealState.cleanupPending) {
    // Branch: During delayed cleanup, staged mode only preserves CSS transition rules.
    return;
  }
  stagedDetailRevealState.settleSequence = stagedDetailRevealState.sequence;
  if (stagedDetailRevealState.settleTimer) {
    // Branch: Replace the previous settle timer so only the latest edge state queues work.
    window.clearTimeout(stagedDetailRevealState.settleTimer);
  }
  stagedDetailRevealState.settleTimer = window.setTimeout(settleStagedDetailRevealQueue, DETAIL_REVEAL_SETTLE_MS);
}
