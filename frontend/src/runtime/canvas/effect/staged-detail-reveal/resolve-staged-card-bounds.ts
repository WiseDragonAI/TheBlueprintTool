/**
 * WHAT: Resolves a card element into world-space bounds for staged reveal ordering.
 * WHY: Detail reveal needs viewport priority without forcing browser layout measurement.
 */
import type { CanvasBounds } from '../../../card/helper/visible-ledger-cards.js';
import { parseStagedDetailPixels } from './parse-staged-detail-pixels.js';

export function resolveStagedCardBounds(element: HTMLElement): CanvasBounds {
  const cachedWidth = parseStagedDetailPixels(element.dataset.sizeCacheWidth, 280);
  const cachedHeight = parseStagedDetailPixels(element.dataset.sizeCacheHeight, 132);
  return {
    x: parseStagedDetailPixels(element.style.left, 0),
    y: parseStagedDetailPixels(element.style.top, 0),
    width: parseStagedDetailPixels(element.style.width, cachedWidth),
    height: parseStagedDetailPixels(element.style.height, cachedHeight)
  };
}
