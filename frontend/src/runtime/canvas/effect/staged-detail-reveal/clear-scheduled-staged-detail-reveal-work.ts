/**
 * WHAT: Clears pending timers and frame callbacks for staged detail reveal.
 * WHY: Crossing back into low detail must stop queued reveal work immediately.
 */
import { stagedDetailRevealState } from './state.js';

export function clearScheduledStagedDetailRevealWork(): void {
  if (stagedDetailRevealState.settleTimer) {
    // Branch: Cancel the debounce timer before it can enqueue a stale reveal pass.
    window.clearTimeout(stagedDetailRevealState.settleTimer);
    stagedDetailRevealState.settleTimer = 0;
  }
  if (stagedDetailRevealState.frameHandle) {
    // Branch: Cancel urgent RAF work so low-detail zoom-out cannot keep revealing card DOM.
    window.cancelAnimationFrame(stagedDetailRevealState.frameHandle);
    stagedDetailRevealState.frameHandle = 0;
  }
  if (stagedDetailRevealState.idleHandle) {
    // Branch: Cancel delayed cleanup because it is not relevant after a mode edge reversal.
    window.clearTimeout(stagedDetailRevealState.idleHandle);
    stagedDetailRevealState.idleHandle = 0;
  }
}
