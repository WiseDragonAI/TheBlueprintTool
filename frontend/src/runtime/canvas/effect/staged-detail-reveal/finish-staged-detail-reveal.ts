/**
 * WHAT: Completes staged reveal and removes scheduler-owned CSS state.
 * WHY: The canvas must return to steady normal-detail rendering after queued reveal work ends.
 */
import { canvas } from '../../../dom.js';
import { telemetry } from '../../../telemetry/effect/telemetry.js';
import { stagedDetailRevealState } from './state.js';

export function finishStagedDetailReveal(): void {
  telemetry('detail-reveal-complete', {
    averageCardCostMs: Number(stagedDetailRevealState.averageCardCostMs.toFixed(3)),
    nextChunkSize: stagedDetailRevealState.nextChunkSize
  });
  canvas.classList.remove('detail-reveal-staged');
  stagedDetailRevealState.urgentQueue = [];
  stagedDetailRevealState.backgroundQueue = [];
}
