/**
 * WHAT: Sorts urgent reveal cards by visibility first and distance second.
 * WHY: The first post-threshold frames should restore visible card details before nearby offscreen cards.
 */
import type { RevealCard } from './types.js';

export function compareUrgentRevealCard(a: RevealCard, b: RevealCard): number {
  if (a.visible !== b.visible) {
    // Branch: Visible cards win over near but currently offscreen cards.
    return a.visible ? -1 : 1;
  }
  // Branch: Cards with the same visibility state reveal from nearest to farthest.
  return a.distance - b.distance;
}
