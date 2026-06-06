/**
 * WHAT: Completes staged detail reveal after the opacity transition window.
 * WHY: The transition CSS class must survive long enough for visible cards to fade in.
 */
import { finishStagedDetailReveal } from './finish-staged-detail-reveal.js';
import { stagedDetailRevealState } from './state.js';

export function completeStagedDetailRevealAfterTransition(): void {
  stagedDetailRevealState.idleHandle = 0;
  if (stagedDetailRevealState.backgroundSequence !== stagedDetailRevealState.sequence) {
    // Branch: Ignore stale completion timers after cancellation or a newer reveal sequence.
    return;
  }
  // Branch: The opacity transition window elapsed, so the canvas can leave staged reveal mode.
  finishStagedDetailReveal();
}
