/**
 * WHAT: Adapts urgent reveal chunk size from observed card reveal cost.
 * WHY: The scheduler should stay under the frame budget instead of using a fixed large batch.
 */
import { DETAIL_REVEAL_MAX_CHUNK, DETAIL_REVEAL_TARGET_MS } from './constants.js';
import { stagedDetailRevealState } from './state.js';

export function adaptStagedDetailRevealChunkSize(revealed: number, durationMs: number): void {
  if (revealed <= 0) {
    // Branch: No completed card means there is no useful cost sample to incorporate.
    return;
  }
  const measuredCost = Math.max(0.05, durationMs / revealed);
  stagedDetailRevealState.averageCardCostMs = stagedDetailRevealState.averageCardCostMs * 0.7 + measuredCost * 0.3;
  stagedDetailRevealState.nextChunkSize = Math.max(1, Math.min(DETAIL_REVEAL_MAX_CHUNK, Math.floor(DETAIL_REVEAL_TARGET_MS / stagedDetailRevealState.averageCardCostMs)));
}
