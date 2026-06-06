/**
 * WHAT: Patches one ledger-authored card into the canvas DOM.
 * WHY: Ledger cards own geometry, thread identity, tabs, labels, and markdown body rendering.
 */
import { createCardResizeHandles } from '../../card/component/create-card-resize-handles.js';
import { cardPersistedWorkStatus, resolveCardWorkStatus } from '../../card/helper/resolve-card-work-status.js';
import { state } from '../../state.js';
import { cardFields } from '../helper/card-fields.js';
import { cardLabels } from '../helper/card-labels.js';
import { applyZoneAttributionToCardElement, normalizeZoneAttribution, type ZoneAttribution } from '../helper/zone-attribution-cache.js';
import { createLedgerCardDetailLayer } from './create-ledger-card-detail-layer.js';
import { createLedgerCardOverviewLayer } from './create-ledger-card-overview-layer.js';

export function patchLedgerCard(card: Record<string, unknown>, existing?: HTMLElement | null, attribution?: ZoneAttribution | Record<string, unknown> | null): HTMLElement {
  const element = existing ?? document.createElement('article');
  const id = String(card.id ?? '');
  const labels = cardLabels(card);
  const fields = cardFields(card);
  const activeTab = fields.length > 0 && state.cardUi?.activeTabByCardId?.[id] === 'fields' ? 'fields' : 'description';
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
  const fixedHeight = Math.max(132, Number.isFinite(cardHeight) ? cardHeight : 132);
  element.style.height = `${fixedHeight}px`;
  element.style.removeProperty('min-height');
  element.dataset.sizeCacheWidth = String(Math.max(220, Number(card.w ?? 280)));
  element.dataset.sizeCacheHeight = String(fixedHeight);
  element.style.setProperty('--card-size-cache-width', `${Math.max(220, Number(card.w ?? 280))}px`);
  element.style.setProperty('--card-size-cache-height', `${fixedHeight}px`);
  const handles = createCardResizeHandles();
  const detailHost = (element.querySelector('.ledger-card-detail-host') as HTMLElement | null) ?? document.createElement('div');
  detailHost.className = 'ledger-card-detail-host';
  const overviewHost = (element.querySelector('.ledger-card-overview-host') as HTMLElement | null) ?? document.createElement('div');
  overviewHost.className = 'ledger-card-overview-host';
  if (element.dataset.detailMounted === 'mounted' || element.dataset.detailMounted === 'mounting' || element.dataset.detailMounted === 'unmounting') {
    // Branch: Mounted detail cards refresh their subtree from ledger data when the surface rerenders.
    detailHost.replaceChildren(createLedgerCardDetailLayer(card, id, visibleStatus));
  } else if (!detailHost.querySelector('.ledger-card-detail-layer')) {
    // Branch: Unmounted cards keep an empty host so viewport-driven mounting can populate it later.
    detailHost.replaceChildren();
  }
  if (element.dataset.lowDetailMounted === 'mounted' || element.dataset.lowDetailMounted === 'mounting' || element.dataset.lowDetailMounted === 'unmounting') {
    // Branch: Low-detail cards refresh the visible overview branch while it remains the active mode branch.
    overviewHost.replaceChildren(createLedgerCardOverviewLayer(card, id, visibleStatus));
  } else if (!overviewHost.querySelector('.ledger-card-overview-layer')) {
    // Branch: Detail-mode cards keep an empty overview host so low-detail can mount a fresh branch on entry.
    overviewHost.replaceChildren();
  }
  element.replaceChildren(...handles, detailHost, overviewHost);
  return element;
}
