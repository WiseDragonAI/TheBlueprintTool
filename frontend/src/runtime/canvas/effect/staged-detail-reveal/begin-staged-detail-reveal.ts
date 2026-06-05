/**
 * WHAT: Starts a staged detail reveal after crossing from low-detail to normal-detail zoom.
 * WHY: The edge should hide heavy detail layers first, then reveal them through the scheduler.
 */
import { canvas, content } from '../../../dom.js';
import { state } from '../../../state.js';
import { telemetry } from '../../../telemetry/effect/telemetry.js';
import { clearScheduledStagedDetailRevealWork } from './clear-scheduled-staged-detail-reveal-work.js';
import { stagedDetailRevealState } from './state.js';

export function beginStagedDetailReveal(): void {
  stagedDetailRevealState.sequence += 1;
  clearScheduledStagedDetailRevealWork();
  stagedDetailRevealState.urgentQueue = [];
  stagedDetailRevealState.backgroundQueue = [];
  const cards = content.querySelectorAll<HTMLElement>('.card[data-card-id]');
  for (const element of cards) {
    element.dataset.detailReveal = 'hidden';
  }
  canvas.classList.add('detail-reveal-staged');
  telemetry('detail-reveal-staged', {
    sequence: stagedDetailRevealState.sequence,
    cards: cards.length,
    scale: Number(state.viewport.scale.toFixed(3))
  });
}
