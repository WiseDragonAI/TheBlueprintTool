import { type LedgerCardField } from '../helper/card-fields.js';
import { ledgerCardBody } from '../helper/ledger-card-body.js';
import { renderLedgerCardFields } from './render-ledger-card-fields.js';
import { renderLedgerCardMarkdown } from './render-ledger-card-markdown.js';

export function renderLedgerCardTabFrame(card: Record<string, unknown>, fields: LedgerCardField[], activeTab: string): HTMLElement {
  const frame = document.createElement('div');
  const cardId = String(card.id ?? '');
  const imageSizes = card.imageSizes && typeof card.imageSizes === 'object' && !Array.isArray(card.imageSizes)
    ? card.imageSizes as Record<string, { width?: number; height?: number }>
    : {};
  frame.className = 'ledger-card-tab-frame';
  frame.dataset.activeCardTab = activeTab;
  frame.dataset.spec = 'd0b7e3a9 e4c1b8f5 c6e3b7d1';
  frame.dataset.wheelCapture = 'true';

  const description = renderLedgerCardMarkdown(ledgerCardBody(card), { cardId, imageSizes });
  description.classList.add('ledger-card-panel', 'ledger-card-description-panel');
  description.classList.toggle('is-active', activeTab === 'description');
  description.dataset.cardPanel = 'description';

  const fieldPanel = document.createElement('div');
  fieldPanel.className = 'ledger-card-body ledger-card-panel ledger-card-fields-panel';
  fieldPanel.classList.toggle('is-active', activeTab === 'fields');
  fieldPanel.dataset.cardPanel = 'fields';
  fieldPanel.appendChild(renderLedgerCardFields(fields));

  frame.replaceChildren(description, fieldPanel);
  return frame;
}
