/**
 * WHAT: Removes the low-detail zone label overlay subtree from the canvas content.
 * WHY: Detail mode should not retain low-detail proxy labels across a trip through the detailed presentation branch.
 */
import { content } from '../../dom.js';

export function clearZoneLabelOverlay(): void {
  const overlay = content.querySelector(':scope > .zone-label-overlay') as HTMLElement | null;
  if (!overlay) return;
  overlay.remove();
}
