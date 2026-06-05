/**
 * WHAT: Finishes staged reveal after urgent visible and near cards are restored.
 * WHY: Distant cards must not keep a background scheduler alive after the user-visible edge animation.
 */
import { finishStagedDetailReveal } from './finish-staged-detail-reveal.js';
import { stagedDetailRevealState } from './state.js';

export function scheduleBackgroundStagedDetailReveal(currentSequence: number): void {
  if (currentSequence !== stagedDetailRevealState.sequence) {
    // Branch: Ignore stale completion requests after cancellation or a newer staged reveal.
    return;
  }
  // Branch: Clear staged mode now; offscreen cards do not need a per-card reveal queue.
  finishStagedDetailReveal();
}
