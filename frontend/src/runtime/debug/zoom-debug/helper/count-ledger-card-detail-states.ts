/**
 * WHAT: Counts the live card detail mount states rendered in the current canvas DOM.
 * WHY: Debugging path-dependent zoom and pan issues requires proving whether heavy detail DOM is still physically mounted.
 */
import { content } from '../../../dom.js';

export function countLedgerCardDetailStates(): {
  cards: number;
  detailLayers: number;
  mounted: number;
  mounting: number;
  unmounting: number;
} {
  let cards = 0;
  let detailLayers = 0;
  let mounted = 0;
  let mounting = 0;
  let unmounting = 0;
  for (const card of content.querySelectorAll<HTMLElement>('.card[data-card-id]')) {
    cards += 1;
    // Branch: Count physical heavy detail DOM separately so debug can expose stale mounted content even if state flags drift.
    if (card.querySelector('.ledger-card-detail-host > .ledger-card-detail-layer')) detailLayers += 1;
    const detailMounted = card.dataset.detailMounted ?? '';
    if (detailMounted === 'mounted') mounted += 1;
    else if (detailMounted === 'mounting') mounting += 1;
    else if (detailMounted === 'unmounting') unmounting += 1;
  }
  return { cards, detailLayers, mounted, mounting, unmounting };
}
