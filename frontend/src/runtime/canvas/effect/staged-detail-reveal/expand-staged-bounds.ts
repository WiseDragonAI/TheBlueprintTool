/**
 * WHAT: Expands viewport bounds to include near-viewport cards.
 * WHY: Cards adjacent to the viewport should reveal before distant background cards after a zoom-in edge.
 */
import type { CanvasBounds } from '../../../card/helper/visible-ledger-cards.js';

export function expandStagedBounds(bounds: CanvasBounds): CanvasBounds {
  return {
    x: bounds.x - bounds.width,
    y: bounds.y - bounds.height,
    width: bounds.width * 3,
    height: bounds.height * 3
  };
}
