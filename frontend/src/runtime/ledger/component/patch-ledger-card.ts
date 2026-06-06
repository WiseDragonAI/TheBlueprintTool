/**
 * WHAT: Patches one ledger-authored card into the canvas DOM.
 * WHY: Ledger cards own geometry, thread identity, tabs, labels, and markdown body rendering.
 */
import { state } from '../../state.js';
import { createCardResizeHandles } from '../../card/component/create-card-resize-handles.js';
import { cardFields } from '../helper/card-fields.js';
import { cardLabels } from '../helper/card-labels.js';
import { cardPersistedWorkStatus, resolveCardWorkStatus } from '../../card/helper/resolve-card-work-status.js';
import { applyZoneAttributionToCardElement, normalizeZoneAttribution, type ZoneAttribution } from '../helper/zone-attribution-cache.js';
import { renderLedgerCardDetailLayer, renderLedgerCardOverviewLayer } from './render-ledger-card-detail-layer.js';

function directChildByClass(element: HTMLElement, className: string): HTMLElement | null {
  for (const child of Array.from(element.children) as HTMLElement[]) {
    if (child.className.split(/\s+/).includes(className)) return child;
  }
  return null;
}

export function patchLedgerCard(card: Record<string, unknown>, existing?: HTMLElement | null, attribution?: ZoneAttribution | Record<string, unknown> | null): HTMLElement {
  const element = existing ?? document.createElement('article');
  const id = String(card.id ?? '');
  const labels = cardLabels(card);
  const fields = cardFields(card);
  const hasFieldTabs = fields.length > 0;
  const activeTab = hasFieldTabs && state.cardUi?.activeTabByCardId?.[id] === 'fields' ? 'fields' : 'description';
  const persistedStatus = cardPersistedWorkStatus(card);
  const visibleStatus = resolveCardWorkStatus(card);
  const detailVisible = element.className.split(/\s+/).includes('detail-visible');
  element.className = `card ledger-node${detailVisible ? ' detail-visible' : ''}`;
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
  const mountedDetail = directChildByClass(element, 'ledger-card-detail-layer');
  const detailLayer = mountedDetail ? renderLedgerCardDetailLayer(card, mountedDetail) : null;
  const overview = renderLedgerCardOverviewLayer(card, id, visibleStatus);
  element.replaceChildren(...handles, ...(detailLayer ? [detailLayer] : []), overview);
  return element;
}
