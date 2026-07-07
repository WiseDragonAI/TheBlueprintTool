/**
 * WHAT: Builds the expensive, full-detail DOM for a ledger card.
 * WHY: The canvas keeps low-detail cards cheap by hydrating this subtree only for visible cards.
 */
import { state } from '../../state.js';
import { renderCardSkillRunWidget } from '../../codex/component/render-card-skill-run-widget.js';
import { cardFields } from '../helper/card-fields.js';
import { cardLabels } from '../helper/card-labels.js';
import { ledgerCardBody } from '../helper/ledger-card-body.js';
import { resolveCardWorkStatus } from '../../card/helper/resolve-card-work-status.js';
import { appendTitleText } from './append-title-text.js';
import { renderLedgerCardLabels } from './render-ledger-card-labels.js';
import { renderLedgerCardMarkdown } from './render-ledger-card-markdown.js';
import { renderLedgerCardTabFrame } from './render-ledger-card-tab-frame.js';
import { renderLedgerCardTabs } from './render-ledger-card-tabs.js';

function isLinkedLedgerCard(card: Record<string, unknown>): boolean {
  return String(card.cardType ?? '') === 'ledger' || String(card.targetLedgerId ?? '').trim() !== '';
}

export function createLedgerCardTitle(card: Record<string, unknown>, id: string, className = 'ledger-card-title'): HTMLElement {
  const title = document.createElement('strong');
  title.className = className;
  appendTitleText(title, String(card.title ?? id));
  return title;
}

export function createLedgerCardTitleEditButton(card: Record<string, unknown>, id: string): HTMLButtonElement {
  const edit = document.createElement('button');
  edit.className = 'ledger-card-title-edit-button icon-button terminal-button terminal-button--compact';
  edit.type = 'button';
  edit.dataset.action = 'edit-card-title';
  edit.dataset.cardId = id;
  edit.title = isLinkedLedgerCard(card) ? 'Edit ledger name' : 'Edit card title';
  edit.setAttribute('aria-label', edit.title);
  edit.textContent = '✎';
  return edit;
}

export function createLedgerCardTitleRow(card: Record<string, unknown>, id: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'ledger-card-title-row';
  row.replaceChildren(createLedgerCardTitle(card, id), createLedgerCardTitleEditButton(card, id));
  return row;
}

export function createCardStatusIndicator(status: string, className = 'card-status-indicator'): HTMLElement {
  const statusIndicator = document.createElement('span');
  statusIndicator.className = className;
  statusIndicator.dataset.spec = 'c4e8b91a';
  statusIndicator.title = `Card status: ${status}`;
  statusIndicator.ariaLabel = statusIndicator.title;
  statusIndicator.textContent = status;
  return statusIndicator;
}

export function resolveLedgerCardActiveTab(card: Record<string, unknown>, id = String(card.id ?? '')): string {
  const fields = cardFields(card);
  return fields.length > 0 && state.cardUi?.activeTabByCardId?.[id] === 'fields' ? 'fields' : 'description';
}

export function renderLedgerCardOverviewLayer(card: Record<string, unknown>, id = String(card.id ?? ''), visibleStatus = resolveCardWorkStatus(card)): HTMLElement {
  const overview = document.createElement('div');
  overview.className = 'ledger-card-overview-layer';
  const linkedLedgerCard = isLinkedLedgerCard(card);
  if (linkedLedgerCard) overview.classList.add('ledger-card-overview-layer--ledger');
  overview.replaceChildren(
    createLedgerCardTitle(card, id, 'ledger-card-overview-title'),
    ...(linkedLedgerCard ? [] : [createCardStatusIndicator(visibleStatus, 'card-status-indicator ledger-card-overview-status')])
  );
  return overview;
}

export function renderLedgerCardDetailLayer(card: Record<string, unknown>, existing?: HTMLElement | null): HTMLElement {
  const id = String(card.id ?? '');
  const labels = cardLabels(card);
  const fields = cardFields(card);
  const activeTab = resolveLedgerCardActiveTab(card, id);
  const visibleStatus = resolveCardWorkStatus(card);
  const imageSizes = card.imageSizes && typeof card.imageSizes === 'object' && !Array.isArray(card.imageSizes)
    ? card.imageSizes as Record<string, { width?: number; height?: number }>
    : {};
  const body = fields.length > 0
    ? renderLedgerCardTabFrame(card, fields, activeTab)
    : renderLedgerCardMarkdown(ledgerCardBody(card), { cardId: id, imageSizes });
  const detailLayer = existing ?? document.createElement('div');
  const labelNodes = labels.length > 0 ? [renderLedgerCardLabels(labels)] : [];
  const tabs = fields.length > 0 ? [renderLedgerCardTabs(id, activeTab)] : [];
  const codexRunWidget = renderCardSkillRunWidget(card);
  detailLayer.className = 'ledger-card-detail-layer';
  const linkedLedgerCard = isLinkedLedgerCard(card);
  detailLayer.replaceChildren(...(linkedLedgerCard ? [] : [createCardStatusIndicator(visibleStatus)]), ...labelNodes, createLedgerCardTitleRow(card, id), ...(codexRunWidget ? [codexRunWidget] : []), ...tabs, body);
  return detailLayer;
}
