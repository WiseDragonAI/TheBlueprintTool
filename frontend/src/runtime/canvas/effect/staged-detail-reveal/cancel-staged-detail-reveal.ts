/**
 * WHAT: Cancels staged reveal work and removes staged detail CSS state.
 * WHY: Crossing into low-detail must leave no perpetual reveal scheduler or normal-detail work behind.
 */
import { canvas } from '../../../dom.js';
import { clearScheduledStagedDetailRevealWork } from './clear-scheduled-staged-detail-reveal-work.js';
import { stagedDetailRevealState } from './state.js';

export function cancelStagedDetailReveal(): void {
  const hasScheduledWork = Boolean(
    stagedDetailRevealState.settleTimer
      || stagedDetailRevealState.frameHandle
      || stagedDetailRevealState.idleHandle
      || stagedDetailRevealState.urgentQueue.length
      || stagedDetailRevealState.backgroundQueue.length
  );
  if (!hasScheduledWork && !canvas.classList.contains('detail-reveal-staged')) {
    // Branch: Do nothing in steady low-detail mode so repeated viewport updates are cheap.
    return;
  }
  stagedDetailRevealState.sequence += 1;
  clearScheduledStagedDetailRevealWork();
  stagedDetailRevealState.urgentQueue = [];
  stagedDetailRevealState.backgroundQueue = [];
  canvas.classList.remove('detail-reveal-staged');
}
