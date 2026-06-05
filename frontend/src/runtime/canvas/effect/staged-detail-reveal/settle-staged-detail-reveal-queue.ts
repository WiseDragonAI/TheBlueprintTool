/**
 * WHAT: Queues staged detail reveal cards after the zoom transition settles.
 * WHY: The scheduler should run at the low-detail to normal-detail edge, not on every viewport update.
 */
import { canvas } from '../../../dom.js';
import { DETAIL_REVEAL_MAX_CHUNK, DETAIL_REVEAL_TARGET_MS } from './constants.js';
import { orderStagedDetailRevealCards } from './order-staged-detail-reveal-cards.js';
import { revealUrgentStagedDetailFrame } from './reveal-urgent-staged-detail-frame.js';
import { scheduleBackgroundStagedDetailReveal } from './schedule-background-staged-detail-reveal.js';
import { stagedDetailRevealState } from './state.js';
import { telemetry } from '../../../telemetry/effect/telemetry.js';

export function settleStagedDetailRevealQueue(): void {
  stagedDetailRevealState.settleTimer = 0;
  if (stagedDetailRevealState.settleSequence !== stagedDetailRevealState.sequence || !canvas.classList.contains('detail-reveal-staged')) {
    // Branch: Ignore stale settle timers after cancellation or a newer staged reveal.
    return;
  }

  const ordered = orderStagedDetailRevealCards();
  stagedDetailRevealState.urgentQueue = ordered.urgent;
  stagedDetailRevealState.backgroundQueue = ordered.background;
  stagedDetailRevealState.nextChunkSize = Math.max(1, Math.min(DETAIL_REVEAL_MAX_CHUNK, Math.floor(DETAIL_REVEAL_TARGET_MS / stagedDetailRevealState.averageCardCostMs)));
  telemetry('detail-reveal-queue', {
    sequence: stagedDetailRevealState.sequence,
    visibleCards: ordered.visibleCount,
    urgentCards: stagedDetailRevealState.urgentQueue.length,
    backgroundCards: stagedDetailRevealState.backgroundQueue.length,
    averageCardCostMs: Number(stagedDetailRevealState.averageCardCostMs.toFixed(3)),
    nextChunkSize: stagedDetailRevealState.nextChunkSize
  });

  if (stagedDetailRevealState.urgentQueue.length > 0) {
    // Branch: Start visible and near-card reveal on RAF when there is urgent work.
    stagedDetailRevealState.frameSequence = stagedDetailRevealState.settleSequence;
    stagedDetailRevealState.frameHandle = window.requestAnimationFrame(revealUrgentStagedDetailFrame);
    return;
  }
  // Branch: If no card is near the viewport, skip directly to idle background reveal.
  scheduleBackgroundStagedDetailReveal(stagedDetailRevealState.settleSequence);
}
