/**
 * WHAT: Clears per-card staged detail reveal markers from the canvas content.
 * WHY: Overview steady state must not retain transition-only card attributes after reveal work ends.
 */
import { content } from '../../../dom.js';

export function clearStagedDetailRevealAttributes(): void {
  for (const element of content.querySelectorAll<HTMLElement>('.card[data-card-id][data-detail-reveal]')) {
    delete element.dataset.detailReveal;
  }
}
