/**
 * WHAT: Patches one ledger-authored card into the canvas DOM.
 * WHY: Ledger cards own geometry, thread identity, tabs, labels, and markdown body rendering.
 */
import { state } from '../../state.js';
import { createCardResizeHandles } from '../../card/component/create-card-resize-handles.js';
import { appendTitleText } from './append-title-text.js';
import { cardFields } from '../helper/card-fields.js';
import { cardLabels } from '../helper/card-labels.js';
import { cardPersistedWorkStatus, resolveCardWorkStatus } from '../../card/helper/resolve-card-work-status.js';
import { ledgerCardBody } from '../helper/ledger-card-body.js';
import { renderLedgerCardLabels } from './render-ledger-card-labels.js';
import { renderLedgerCardMarkdown } from './render-ledger-card-markdown.js';
import { renderLedgerCardTabFrame } from './render-ledger-card-tab-frame.js';
import { renderLedgerCardTabs } from './render-ledger-card-tabs.js';
import { renderLedgerCardDeleteButton } from './render-ledger-card-delete-button.js';
import { renderLedgerCardStatusButton } from './render-ledger-card-status-button.js';
import { applyZoneAttributionToCardElement, normalizeZoneAttribution, type ZoneAttribution } from '../helper/zone-attribution-cache.js';

export function patchLedgerCard(card: Record<string, unknown>, existing?: HTMLElement | null, attribution?: ZoneAttribution | Record<string, unknown> | null): HTMLElement {
  const element = existing ?? document.createElement('article');
  const id = String(card.id ?? '');
  const labels = cardLabels(card);
  const fields = cardFields(card);
  const hasFieldTabs = fields.length > 0;
  const activeTab = hasFieldTabs && state.cardUi?.activeTabByCardId?.[id] === 'fields' ? 'fields' : 'description';
  const persistedStatus = cardPersistedWorkStatus(card);
  const visibleStatus = resolveCardWorkStatus(card);
  element.className = 'card ledger-node';
  element.dataset.cardId = id;
  element.dataset.activeCardTab = activeTab;
  element.dataset.threadId = `thread-${id}`;
  element.dataset.ledgerNode = 'card';
  element.dataset.cardStatus = persistedStatus;
  element.dataset.cardWorkStatus = visibleStatus;
  delete element.dataset.agentLastAnswer;
  if (labels.length > 0) element.dataset.cardLabels = labels.join(',');
  else delete element.dataset.cardLabels;
  applyZoneAttributionToCardElement(element, normalizeZoneAttribution(attribution));
  element.style.left = `${Number(card.x ?? 0)}px`;
  element.style.top = `${Number(card.y ?? 0)}px`;
  element.style.width = `${Math.max(220, Number(card.w ?? 280))}px`;
  const cardHeight = Number(card.h ?? card.height);
  if (Number.isFinite(cardHeight) && hasFieldTabs) {
    element.style.minHeight = `${Math.max(132, cardHeight)}px`;
    element.style.removeProperty('height');
  } else if (Number.isFinite(cardHeight)) {
    element.style.height = `${Math.max(132, cardHeight)}px`;
    element.style.removeProperty('min-height');
  } else {
    element.style.removeProperty('height');
    element.style.removeProperty('min-height');
  }
  const hash = document.createElement('span');
  hash.className = 'hash';
  hash.textContent = `#${id}`;
  const statusIndicator = document.createElement('span');
  statusIndicator.className = 'card-status-indicator';
  statusIndicator.dataset.spec = 'c4e8b91a';
  statusIndicator.title = `Card status: ${visibleStatus}`;
  statusIndicator.ariaLabel = statusIndicator.title;
  statusIndicator.textContent = visibleStatus;
  const title = document.createElement('strong');
  title.className = 'ledger-card-title';
  appendTitleText(title, String(card.title ?? id));
  const imageSizes = card.imageSizes && typeof card.imageSizes === 'object' && !Array.isArray(card.imageSizes)
    ? card.imageSizes as Record<string, { width?: number; height?: number }>
    : {};
  const body = hasFieldTabs ? renderLedgerCardTabFrame(card, fields, activeTab) : renderLedgerCardMarkdown(ledgerCardBody(card), { cardId: id, imageSizes });
  const handles = createCardResizeHandles();
  const deleteButton = renderLedgerCardDeleteButton(id);
  const statusButton = renderLedgerCardStatusButton(id, persistedStatus, visibleStatus);
  const labelNodes = labels.length > 0 ? [renderLedgerCardLabels(labels)] : [];
  const tabs = hasFieldTabs ? [renderLedgerCardTabs(id, activeTab)] : [];
  element.replaceChildren(...handles, deleteButton, statusButton, statusIndicator, hash, ...labelNodes, title, ...tabs, body);
  return element;
}
