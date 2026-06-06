/**
 * WHAT: Builds visible, near, and background reveal queues from existing card styles.
 * WHY: The scheduler needs a deterministic reveal order without `getBoundingClientRect` or other layout reads.
 */
import { canvas, content } from '../../../dom.js';
import { state } from '../../../state.js';
import { canvasBoundsIntersect, viewportWorldBounds } from '../../../card/helper/visible-ledger-cards.js';
import { calculateStagedCardDistance } from './calculate-staged-card-distance.js';
import { compareBackgroundRevealCard } from './compare-background-reveal-card.js';
import { compareUrgentRevealCard } from './compare-urgent-reveal-card.js';
import { expandStagedBounds } from './expand-staged-bounds.js';
import { resolveStagedCardBounds } from './resolve-staged-card-bounds.js';
import type { OrderedRevealCards, RevealCard } from './types.js';

export function orderStagedDetailRevealCards(): OrderedRevealCards {
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  if (!viewportWidth) {
    // Branch: Use the canvas element width when the window width is unavailable in tests or embedded contexts.
    viewportWidth = canvas.clientWidth;
  }
  if (!viewportHeight) {
    // Branch: Use the canvas element height when the window height is unavailable in tests or embedded contexts.
    viewportHeight = canvas.clientHeight;
  }

  const viewportBounds = viewportWorldBounds(state.viewport, { width: viewportWidth, height: viewportHeight });
  const nearBounds = expandStagedBounds(viewportBounds);
  const centerX = viewportBounds.x + viewportBounds.width / 2;
  const centerY = viewportBounds.y + viewportBounds.height / 2;
  const urgent: RevealCard[] = [];
  const background: RevealCard[] = [];
  let visibleCount = 0;

  for (const element of content.querySelectorAll<HTMLElement>('.card[data-card-id]')) {
    const bounds = resolveStagedCardBounds(element);
    const visible = canvasBoundsIntersect(bounds, viewportBounds);
    const near = visible || canvasBoundsIntersect(bounds, nearBounds);
    const entry = { element, visible, distance: calculateStagedCardDistance(bounds, centerX, centerY) };
    if (visible) {
      // Branch: Count currently visible cards so telemetry can prove how much work is first-frame critical.
      visibleCount += 1;
    }
    if (near) {
      // Branch: Visible and near-viewport cards enter the RAF-budgeted urgent queue.
      urgent.push(entry);
    } else {
      // Branch: Distant cards are deferred to idle background reveal.
      background.push(entry);
    }
  }

  urgent.sort(compareUrgentRevealCard);
  background.sort(compareBackgroundRevealCard);
  return { urgent, background, visibleCount };
}
