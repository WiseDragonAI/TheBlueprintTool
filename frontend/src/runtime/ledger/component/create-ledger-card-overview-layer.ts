/**
 * WHAT: Creates the always-mounted lightweight low-detail card presentation layer.
 * WHY: Low-detail must remain readable even when the heavy detail subtree is unmounted.
 */
import { createCardStatusIndicator } from './create-card-status-indicator.js';
import { createLedgerCardTitle } from './create-ledger-card-title.js';

export function createLedgerCardOverviewLayer(card: Record<string, unknown>, id: string, status: string): HTMLElement {
  const overview = document.createElement('div');
  overview.className = 'ledger-card-overview-layer';
  overview.replaceChildren(
    createLedgerCardTitle(card, id, 'ledger-card-overview-title'),
    createCardStatusIndicator(status, 'card-status-indicator ledger-card-overview-status')
  );
  return overview;
}
