/**
 * WHAT: Sorts background reveal cards by distance from the viewport center.
 * WHY: Idle reveal work should still advance from near context toward distant cards.
 */
import type { RevealCard } from './types.js';

export function compareBackgroundRevealCard(a: RevealCard, b: RevealCard): number {
  return a.distance - b.distance;
}
