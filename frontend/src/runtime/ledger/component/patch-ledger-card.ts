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
import { renderGeometry } from '../../canvas/helper/render-density.js';
import { clampReadableHsvColor } from '../../card/effect/render-card-zone-colors.js';

function directChildByClass(element: HTMLElement, className: string): HTMLElement | null {
  for (const child of Array.from(element.children) as HTMLElement[]) {
    if (child.className.split(/\s+/).includes(className)) return child;
  }
  return null;
}

function applyCardColorOverride(element: HTMLElement, card: Record<string, unknown>): void {
  const color = typeof card.color === 'string' ? card.color.trim() : '';
  const readableColor = color ? clampReadableHsvColor(color) : null;
  if (!readableColor) return;
  delete element.dataset.cardZoneId;
  element.dataset.cardZoneColor = color;
  element.style.setProperty('--card-zone-color', color);
  element.style.setProperty('--card-code-color', readableColor);
  element.style.setProperty('--card-readable-color', readableColor);
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
  const targetLedgerId = String(card.targetLedgerId ?? '').trim();
  const targetProjectId = String(card.targetProjectId ?? '').trim();
  const cardType = String(card.cardType ?? '').trim();
  element.className = `card ledger-node${detailVisible ? ' detail-visible' : ''}`;
  element.dataset.cardId = id;
  if (cardType) element.dataset.cardType = cardType;
  else delete element.dataset.cardType;
  if (targetLedgerId) element.dataset.targetLedgerId = targetLedgerId;
  else delete element.dataset.targetLedgerId;
  if (targetProjectId) element.dataset.targetProjectId = targetProjectId;
  else delete element.dataset.targetProjectId;
  element.dataset.activeCardTab = activeTab;
  element.dataset.threadId = `thread-${id}`;
  element.dataset.ledgerNode = 'card';
  element.dataset.cardStatus = persistedStatus;
  element.dataset.cardWorkStatus = visibleStatus;
  delete element.dataset.agentLastAnswer;
  if (labels.length > 0) element.dataset.cardLabels = labels.join(',');
  else delete element.dataset.cardLabels;
  applyZoneAttributionToCardElement(element, normalizeZoneAttribution(attribution));
  applyCardColorOverride(element, card);
  const width = Math.max(220, Number(card.w ?? 280));
  const cardHeight = Number(card.h ?? card.height);
  const fixedHeight = Math.max(132, Number.isFinite(cardHeight) ? cardHeight : 132);
  const geometry = { x: Number(card.x ?? 0), y: Number(card.y ?? 0), width, height: fixedHeight };
  const renderedGeometry = renderGeometry(geometry);
  element.style.left = `${renderedGeometry.x}px`;
  element.style.top = `${renderedGeometry.y}px`;
  element.style.width = `${renderedGeometry.width}px`;
  element.style.height = `${renderedGeometry.height}px`;
  element.style.minHeight = `${renderedGeometry.height}px`;
  element.dataset.sizeCacheWidth = String(width);
  element.dataset.sizeCacheHeight = String(fixedHeight);
  element.style.setProperty('--card-size-cache-width', `${width}px`);
  element.style.setProperty('--card-size-cache-height', `${fixedHeight}px`);
  const handles = createCardResizeHandles();
  const mountedDetail = directChildByClass(element, 'ledger-card-detail-layer');
  const detailLayer = mountedDetail ? renderLedgerCardDetailLayer(card, mountedDetail) : null;
  const overview = renderLedgerCardOverviewLayer(card, id, visibleStatus);
  element.replaceChildren(...handles, ...(detailLayer ? [detailLayer] : []), overview);
  return element;
}
