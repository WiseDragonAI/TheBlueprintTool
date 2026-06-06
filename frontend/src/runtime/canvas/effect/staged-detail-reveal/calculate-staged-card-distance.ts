/**
 * WHAT: Calculates a card center distance from the viewport center.
 * WHY: Reveal queues use spatial priority so nearby cards become detailed first.
 */
import type { CanvasBounds } from '../../../card/helper/visible-ledger-cards.js';

export function calculateStagedCardDistance(bounds: CanvasBounds, centerX: number, centerY: number): number {
  const cardCenterX = bounds.x + bounds.width / 2;
  const cardCenterY = bounds.y + bounds.height / 2;
  return Math.hypot(cardCenterX - centerX, cardCenterY - centerY);
}
