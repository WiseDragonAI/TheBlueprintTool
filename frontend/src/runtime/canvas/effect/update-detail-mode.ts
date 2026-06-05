/**
 * WHAT: Updates canvas detail CSS modes from the current viewport scale.
 * WHY: Zoom transitions must flip detail state only at approved thresholds and gate reveal scheduling to mode edges.
 */
import { canvas } from '../../dom.js';
import { state } from '../../state.js';
import { beginStagedDetailReveal, cancelStagedDetailReveal, scheduleStagedDetailReveal } from './stage-detail-reveal.js';

export function updateDetailMode(): void {
  const shouldUseLowDetail = state.viewport.scale < 0.35;
  const shouldUseOverviewDetail = state.viewport.scale < 0.18;
  const hasLowDetail = canvas.classList.contains('low-detail');
  const hasOverviewDetail = canvas.classList.contains('overview-detail');
  if (hasLowDetail !== shouldUseLowDetail) {
    // Branch: A low-detail threshold edge is the only point that can start or cancel reveal work.
    if (shouldUseLowDetail) {
      // Branch: Normal-detail to low-detail hides details and cancels any queued reveal immediately.
      cancelStagedDetailReveal();
    } else {
      // Branch: Low-detail to normal-detail stages detail layers before the reveal scheduler runs.
      beginStagedDetailReveal();
    }
    canvas.classList.toggle('low-detail', shouldUseLowDetail);
  }
  if (hasOverviewDetail !== shouldUseOverviewDetail) {
    // Branch: Overview-detail remains a visual-only mode flip at its independent threshold.
    canvas.classList.toggle('overview-detail', shouldUseOverviewDetail);
  }
  if (!shouldUseLowDetail) {
    // Branch: Scheduling is a no-op unless a low-detail to normal-detail edge already staged cards.
    scheduleStagedDetailReveal();
  }
}
