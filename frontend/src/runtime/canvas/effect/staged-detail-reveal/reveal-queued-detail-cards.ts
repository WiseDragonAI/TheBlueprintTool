/**
 * WHAT: Marks a bounded number of queued cards as detail-visible.
 * WHY: Reveal work must be chunked so a single frame does not process every card after zoom-in.
 */
import type { RevealCard } from './types.js';

export function revealQueuedDetailCards(queue: RevealCard[], limit: number): number {
  let revealed = 0;
  while (revealed < limit && queue.length > 0) {
    const entry = queue.shift() as RevealCard;
    entry.element.dataset.detailReveal = 'visible';
    revealed += 1;
  }
  return revealed;
}
