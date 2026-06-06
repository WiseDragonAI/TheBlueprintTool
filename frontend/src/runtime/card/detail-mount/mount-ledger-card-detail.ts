/**
 * WHAT: Mounts one card detail subtree and starts the opacity reveal.
 * WHY: Detail mode should restore heavy card content only for the active viewport working set.
 */
import { content } from '../../dom.js';
import { scheduleLedgerCardTabFrameSync } from '../effect/schedule-ledger-card-tab-frame-sync.js';
import { watchLedgerCardTabFrameSize } from '../effect/watch-ledger-card-tab-frame-size.js';
import { createLedgerCardDetailLayer } from '../../ledger/component/create-ledger-card-detail-layer.js';
import { resolveCardWorkStatus } from '../helper/resolve-card-work-status.js';
import { markLedgerCardDetailMounted } from './mark-ledger-card-detail-mounted.js';

export function mountLedgerCardDetail(card: HTMLElement, ledgerCard: Record<string, unknown> | null | undefined): void {
  const id = card.dataset.cardId ?? '';
  const host = card.querySelector('.ledger-card-detail-host') as HTMLElement | null;
  // Branch: Cards without a stable host cannot accept mounted detail content.
  if (!id || !host) return;
  // Branch: Preserve the active visible or mounting detail subtree instead of rebuilding it redundantly.
  if (card.dataset.detailMounted === 'mounted' || card.dataset.detailMounted === 'mounting') return;
  // Branch: Skip cards that no longer exist in the active ledger map.
  if (!ledgerCard) return;
  host.replaceChildren(createLedgerCardDetailLayer(ledgerCard, id, resolveCardWorkStatus(ledgerCard)));
  markLedgerCardDetailMounted(card, 'mounting');
  scheduleLedgerCardTabFrameSync(card);
  watchLedgerCardTabFrameSize(content);
  requestAnimationFrame(() => {
    if (!card.isConnected || card.dataset.detailMounted !== 'mounting') return;
    // Branch: Only the latest mounted host should complete the fade-in after the frame boundary.
    markLedgerCardDetailMounted(card, 'mounted');
  });
}
