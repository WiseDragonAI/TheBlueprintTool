/**
 * WHAT: Reveals one urgent chunk of visible or near card details on an animation frame.
 * WHY: Low-detail to normal zoom should restore visible detail progressively inside the frame budget.
 */
import { canvas } from '../../../dom.js';
import { telemetry } from '../../../telemetry/effect/telemetry.js';
import { adaptStagedDetailRevealChunkSize } from './adapt-staged-detail-reveal-chunk-size.js';
import { revealQueuedDetailCards } from './reveal-queued-detail-cards.js';
import { scheduleBackgroundStagedDetailReveal } from './schedule-background-staged-detail-reveal.js';
import { stagedDetailRevealState } from './state.js';

export function revealUrgentStagedDetailFrame(): void {
  stagedDetailRevealState.frameHandle = 0;
  if (stagedDetailRevealState.frameSequence !== stagedDetailRevealState.sequence || !canvas.classList.contains('detail-reveal-staged')) {
    // Branch: Ignore stale RAF callbacks after cancellation or a new zoom detail edge.
    return;
  }

  const startedAt = performance.now();
  const requested = stagedDetailRevealState.nextChunkSize;
  const revealed = revealQueuedDetailCards(stagedDetailRevealState.urgentQueue, requested);
  const durationMs = performance.now() - startedAt;
  adaptStagedDetailRevealChunkSize(revealed, durationMs);
  telemetry('detail-reveal-frame', {
    phase: 'urgent',
    revealed,
    requested,
    durationMs: Number(durationMs.toFixed(3)),
    averageCardCostMs: Number(stagedDetailRevealState.averageCardCostMs.toFixed(3)),
    nextChunkSize: stagedDetailRevealState.nextChunkSize,
    remainingUrgent: stagedDetailRevealState.urgentQueue.length,
    remainingBackground: stagedDetailRevealState.backgroundQueue.length
  });

  if (stagedDetailRevealState.urgentQueue.length > 0) {
    // Branch: Keep urgent visible/near cards on RAF so the transition progresses with paint.
    stagedDetailRevealState.frameHandle = window.requestAnimationFrame(revealUrgentStagedDetailFrame);
    return;
  }
  // Branch: Once urgent cards are visible, defer distant cards to idle work.
  scheduleBackgroundStagedDetailReveal(stagedDetailRevealState.frameSequence);
}
