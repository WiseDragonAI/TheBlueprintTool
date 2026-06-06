/**
 * WHAT: Reconciles the mounted card detail working set against the current viewport work window.
 * WHY: Detail mode should keep nearby detail alive while unmounting distant heavy subtrees.
 */
import { content } from '../../dom.js';
import { state } from '../../state.js';
import { viewportWorldBounds } from '../helper/visible-ledger-cards.js';
import { activeLedgerCardMap } from '../../ledger/helper/active-ledger-geometry.js';
import { collectDetailMountedCardIds } from './collect-detail-mounted-card-ids.js';
import { beginUnmountLedgerCardDetail } from './begin-unmount-ledger-card-detail.js';
import { mountLedgerCardDetail } from './mount-ledger-card-detail.js';
import { resolveDetailMountBounds } from './resolve-detail-mount-bounds.js';
import { resolveDetailMountCanvasSize } from './resolve-detail-mount-canvas-size.js';

export function syncMountedLedgerCardDetails(): void {
  const ledger = state.activeLedger as { cards?: unknown } | null;
  const cards = Array.isArray(ledger?.cards) ? ledger.cards as Array<Record<string, unknown>> : [];
  const bounds = resolveDetailMountBounds(viewportWorldBounds(state.viewport, resolveDetailMountCanvasSize()));
  const targetIds = collectDetailMountedCardIds(cards, bounds);
  const ledgerCardMap = activeLedgerCardMap();
  for (const card of content.querySelectorAll<HTMLElement>('.card[data-card-id]')) {
    const id = card.dataset.cardId ?? '';
    // Branch: Ignore malformed DOM entries without a stable card id.
    if (!id) continue;
    if (targetIds.has(id)) {
      // Branch: Cards inside the viewport work window keep detail mounted or fade in.
      mountLedgerCardDetail(card, ledgerCardMap.get(id));
      continue;
    }
    // Branch: Cards outside the work window fade out and drop heavy detail DOM.
    beginUnmountLedgerCardDetail(card);
  }
}
