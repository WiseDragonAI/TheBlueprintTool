/**
 * WHAT: Creates the heavy detail subtree for one ledger-authored card.
 * WHY: Detail content must be mountable on demand instead of staying live for every card at all zoom levels.
 */
import { state } from '../../state.js';
import { cardFields } from '../helper/card-fields.js';
import { cardLabels } from '../helper/card-labels.js';
import { ledgerCardBody } from '../helper/ledger-card-body.js';
import { createCardStatusIndicator } from './create-card-status-indicator.js';
import { createLedgerCardTitle } from './create-ledger-card-title.js';
import { renderLedgerCardLabels } from './render-ledger-card-labels.js';
import { renderLedgerCardMarkdown } from './render-ledger-card-markdown.js';
import { renderLedgerCardTabFrame } from './render-ledger-card-tab-frame.js';
import { renderLedgerCardTabs } from './render-ledger-card-tabs.js';

export function createLedgerCardDetailLayer(card: Record<string, unknown>, id: string, status: string): HTMLElement {
  const labels = cardLabels(card);
  const fields = cardFields(card);
  const hasFieldTabs = fields.length > 0;
  const activeTab = hasFieldTabs && state.cardUi?.activeTabByCardId?.[id] === 'fields' ? 'fields' : 'description';
  const imageSizes = card.imageSizes && typeof card.imageSizes === 'object' && !Array.isArray(card.imageSizes)
    ? card.imageSizes as Record<string, { width?: number; height?: number }>
    : {};
  const body = hasFieldTabs
    ? renderLedgerCardTabFrame(card, fields, activeTab)
    : renderLedgerCardMarkdown(ledgerCardBody(card), { cardId: id, imageSizes });
  const detailLayer = document.createElement('div');
  detailLayer.className = 'ledger-card-detail-layer';
  const labelNodes = labels.length > 0 ? [renderLedgerCardLabels(labels)] : [];
  const tabs = hasFieldTabs ? [renderLedgerCardTabs(id, activeTab)] : [];
  detailLayer.replaceChildren(
    createCardStatusIndicator(status),
    ...labelNodes,
    createLedgerCardTitle(card, id),
    ...tabs,
    body
  );
  return detailLayer;
}
