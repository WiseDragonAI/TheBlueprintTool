/**
 * WHAT: Expands viewport world bounds into the padded work window that keeps detail mounted.
 * WHY: Detail mode should mount only nearby cards instead of the full ledger while still avoiding visible pop-in.
 */
import type { CanvasBounds } from '../helper/visible-ledger-cards.js';

export function resolveDetailMountBounds(bounds: CanvasBounds): CanvasBounds {
  return {
    x: bounds.x - bounds.width,
    y: bounds.y - bounds.height,
    width: bounds.width * 3,
    height: bounds.height * 3
  };
}
