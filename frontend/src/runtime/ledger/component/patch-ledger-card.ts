import { state } from '../../state.js';
import { createCardResizeHandles } from '../../card/component/create-card-resize-handles.js';
import { appendTitleText } from './append-title-text.js';
import { cardFields } from '../helper/card-fields.js';
import { cardLabels } from '../helper/card-labels.js';
import { ledgerCardBody } from '../helper/ledger-card-body.js';
import { renderLedgerCardLabels } from './render-ledger-card-labels.js';
import { renderLedgerCardMarkdown } from './render-ledger-card-markdown.js';
import { renderLedgerCardTabFrame } from './render-ledger-card-tab-frame.js';
import { renderLedgerCardTabs } from './render-ledger-card-tabs.js';

export function patchLedgerCard(card: Record<string, unknown>, existing?: HTMLElement | null, zone?: Record<string, unknown> | null): HTMLElement {
  const element = existing ?? document.createElement('article');
  const id = String(card.id ?? '');
  const labels = cardLabels(card);
  const fields = cardFields(card);
  const hasFieldTabs = fields.length > 0;
  const activeTab = hasFieldTabs && state.cardUi?.activeTabByCardId?.[id] === 'fields' ? 'fields' : 'description';
  element.className = 'card ledger-node';
  element.dataset.cardId = id;
  element.dataset.activeCardTab = activeTab;
  element.dataset.threadId = `thread-${id}`;
  element.dataset.ledgerNode = 'card';
  if (labels.length > 0) element.dataset.cardLabels = labels.join(',');
  else delete element.dataset.cardLabels;
  if (zone && typeof zone.color === 'string') {
    if (typeof zone.id === 'string') element.dataset.cardZoneId = zone.id;
    else delete element.dataset.cardZoneId;
    element.dataset.cardZoneColor = zone.color;
    element.style.setProperty('--card-zone-color', zone.color);
  } else {
    delete element.dataset.cardZoneId;
    delete element.dataset.cardZoneColor;
    element.style.removeProperty('--card-zone-color');
  }
  element.style.left = `${Number(card.x ?? 0)}px`;
  element.style.top = `${Number(card.y ?? 0)}px`;
  element.style.width = `${Math.max(220, Number(card.w ?? 280))}px`;
  const cardHeight = Number(card.h ?? card.height);
  if (Number.isFinite(cardHeight)) element.style.height = `${Math.max(132, cardHeight)}px`;
  else element.style.removeProperty('height');
  const hash = document.createElement('span');
  hash.className = 'hash';
  hash.textContent = `#${id}`;
  const title = document.createElement('strong');
  title.className = 'ledger-card-title';
  appendTitleText(title, String(card.title ?? id));
  const body = hasFieldTabs ? renderLedgerCardTabFrame(card, fields, activeTab) : renderLedgerCardMarkdown(ledgerCardBody(card));
  const handles = createCardResizeHandles();
  const labelNodes = labels.length > 0 ? [renderLedgerCardLabels(labels)] : [];
  const tabs = hasFieldTabs ? [renderLedgerCardTabs(id, activeTab)] : [];
  element.replaceChildren(...handles, hash, ...labelNodes, title, ...tabs, body);
  return element;
}
