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
    // Branch: Cancel background idle work because it is not relevant after a mode edge reversal.
    const cancelIdle = (window as any).cancelIdleCallback as ((handle: number) => void) | undefined;
    if (cancelIdle) {
      // Branch: Prefer the browser idle callback cancellation API when available.
      cancelIdle(stagedDetailRevealState.idleHandle);
    } else {
      // Branch: Match the setTimeout fallback used when idle callbacks are unavailable.
      window.clearTimeout(stagedDetailRevealState.idleHandle);
    }
    stagedDetailRevealState.idleHandle = 0;
  }
}
