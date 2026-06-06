/**
 * WHAT: Schedules staged reveal cleanup after urgent visible and near cards are restored.
 * WHY: Distant cards must not queue background work, but visible cards still need the opacity window.
 */
import { DETAIL_REVEAL_OPACITY_MS } from './constants.js';
import { completeStagedDetailRevealAfterTransition } from './complete-staged-detail-reveal-after-transition.js';
import { stagedDetailRevealState } from './state.js';

export function scheduleBackgroundStagedDetailReveal(currentSequence: number): void {
  if (currentSequence !== stagedDetailRevealState.sequence) {
    // Branch: Ignore stale completion requests after cancellation or a newer staged reveal.
    return;
  }
  // Branch: Keep staged mode alive until the CSS opacity transition can paint.
  stagedDetailRevealState.urgentQueue = [];
  stagedDetailRevealState.backgroundQueue = [];
  stagedDetailRevealState.cleanupPending = true;
  stagedDetailRevealState.backgroundSequence = currentSequence;
  stagedDetailRevealState.idleHandle = window.setTimeout(completeStagedDetailRevealAfterTransition, DETAIL_REVEAL_OPACITY_MS);
}
