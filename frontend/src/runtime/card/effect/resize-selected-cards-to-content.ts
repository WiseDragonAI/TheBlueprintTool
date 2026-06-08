import { canvas } from '../../dom.js';
import { renderGeometry } from '../../canvas/helper/render-density.js';
import { forceCardDetailsForMeasurement } from '../../canvas/effect/sync-viewport-card-details.js';
import { activeLedgerAnnotationMap, activeLedgerCardMap, ledgerAnnotationGeometry, ledgerCardGeometry, type LedgerGeometry } from '../../ledger/helper/active-ledger-geometry.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
import { resolveCardYOverlap } from '../helper/resolve-card-y-overlap.js';

export type ResizedCardGeometry = Record<string, { x: number; y: number; width: number; height: number }>;
export type ResizeToContentGeometry = {
  cards: ResizedCardGeometry;
  zones: ResizedCardGeometry;
};

const zoneFitPadding = 96;

type DetailClasses = {
  low: boolean;
  overview: boolean;
};

type BoxGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function resizeZoneGeometryToContainedCards(cards: BoxGeometry[], options: { padding?: number; minWidth?: number; minHeight?: number } = {}): BoxGeometry | null {
  if (cards.length === 0) return null;
  const padding = Math.max(zoneFitPadding, options.padding ?? zoneFitPadding);
  const minWidth = options.minWidth ?? 180;
  const minHeight = options.minHeight ?? 140;
  const left = Math.min(...cards.map((card) => card.x)) - padding;
  const top = Math.min(...cards.map((card) => card.y)) - padding;
  const right = Math.max(...cards.map((card) => card.x + card.width)) + padding;
  const bottom = Math.max(...cards.map((card) => card.y + card.height)) + padding;
  return {
    x: Math.floor(left),
    y: Math.floor(top),
    width: Math.ceil(Math.max(minWidth, right - left)),
    height: Math.ceil(Math.max(minHeight, bottom - top))
  };
}

function selectedCardElements(): HTMLElement[] {
  return Array.from(new Set(state.selection.cardIds))
    .map((id: string) => document.querySelector(`[data-card-id="${CSS.escape(id)}"]`) as HTMLElement | null)
    .filter((card): card is HTMLElement => Boolean(card && !card.hidden));
}

function allCardElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.card[data-card-id]') as NodeListOf<HTMLElement>)
    .filter((card) => !card.hidden);
}

function uniqueCards(cards: HTMLElement[]): HTMLElement[] {
  return Array.from(new Set(cards));
}

function clearLowDetailForMeasurement(): DetailClasses {
  const detail = {
    low: canvas.classList.contains('low-detail'),
    overview: canvas.classList.contains('overview-detail')
  };
  if (detail.low || detail.overview) canvas.classList.remove('low-detail', 'overview-detail');
  return detail;
}

function restoreDetailClasses(detail: DetailClasses): void {
  canvas.classList.toggle('low-detail', detail.low);
  canvas.classList.toggle('overview-detail', detail.overview);
}

function syncCardTabFrameForMeasurement(card: HTMLElement): void {
  for (const frame of Array.from(card.querySelectorAll('.ledger-card-tab-frame')) as HTMLElement[]) {
    const description = frame.querySelector('[data-card-panel="description"]') as HTMLElement | null;
    if (!description) continue;
    const descriptionTop = description.getBoundingClientRect().top;
    const contentHeight = Array.from(description.children).reduce((height, child) => {
      const rect = (child as HTMLElement).getBoundingClientRect();
      return Math.max(height, rect.bottom - descriptionTop);
    }, 0);
    frame.style.setProperty('--ledger-card-tab-height', `${Math.max(96, Math.ceil(contentHeight))}px`);
  }
}

function directChildByClass(element: HTMLElement, className: string): HTMLElement | null {
  for (const child of Array.from(element.children) as HTMLElement[]) {
    if (child.className.split(/\s+/).includes(className)) return child;
  }
  return null;
}

function cardBlockPadding(card: HTMLElement): number {
  const style = getComputedStyle(card);
  return (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
}

function measureNaturalCardHeight(card: HTMLElement, sourceWidth: number): number {
  const previousHeight = card.style.height;
  const previousMinHeight = card.style.minHeight;
  const previousWidth = card.style.width;
  card.style.width = `${sourceWidth}px`;
  card.style.height = 'auto';
  card.style.minHeight = '132px';
  syncCardTabFrameForMeasurement(card);
  const detailLayer = directChildByClass(card, 'ledger-card-detail-layer');
  const measuredHeight = detailLayer?.scrollHeight || detailLayer?.getBoundingClientRect().height || card.scrollHeight || card.getBoundingClientRect().height;
  const height = Math.max(132, Math.ceil(measuredHeight + cardBlockPadding(card)));
  card.style.width = previousWidth;
  card.style.height = previousHeight;
  card.style.minHeight = previousMinHeight;
  return height;
}

function sourceCardGeometry(card: HTMLElement, ledgerCards = activeLedgerCardMap()): LedgerGeometry {
  const cardId = card.dataset.cardId ?? '';
  const ledgerCard = cardId ? ledgerCards.get(cardId) : undefined;
  if (state.activeLedger && ledgerCard) return ledgerCardGeometry(ledgerCard);
  return {
    x: card.offsetLeft,
    y: card.offsetTop,
    width: Math.max(220, card.offsetWidth),
    height: Math.max(132, card.offsetHeight)
  };
}

function sourceZoneGeometry(zone: HTMLElement, ledgerAnnotations = activeLedgerAnnotationMap()): LedgerGeometry {
  const zoneId = zone.dataset.zoneId ?? zone.dataset.groupId ?? '';
  const annotation = zoneId ? ledgerAnnotations.get(zoneId) : undefined;
  if (state.activeLedger && annotation) return ledgerAnnotationGeometry(annotation);
  return {
    x: zone.offsetLeft,
    y: zone.offsetTop,
    width: zone.offsetWidth,
    height: zone.offsetHeight
  };
}

function applyCardBox(card: HTMLElement, geometry: LedgerGeometry): void {
  const renderedGeometry = state.activeLedger ? renderGeometry(geometry) : geometry;
  card.style.left = `${renderedGeometry.x}px`;
  card.style.top = `${renderedGeometry.y}px`;
  card.style.width = `${renderedGeometry.width}px`;
  card.style.height = `${renderedGeometry.height}px`;
  card.style.removeProperty('min-height');
  card.dataset.sizeCacheWidth = String(geometry.width);
  card.dataset.sizeCacheHeight = String(geometry.height);
  card.style.setProperty('--card-size-cache-width', `${geometry.width}px`);
  card.style.setProperty('--card-size-cache-height', `${geometry.height}px`);
}

function selectedZoneElements(): HTMLElement[] {
  return Array.from(new Set(state.selection.zoneIds))
    .map((id: string) => document.querySelector(`[data-zone-id="${CSS.escape(id)}"]`) as HTMLElement | null)
    .filter((zone): zone is HTMLElement => Boolean(zone && !zone.hidden));
}

function geometriesIntersect(a: LedgerGeometry, b: LedgerGeometry): boolean {
  return a.x + a.width >= b.x && a.x <= b.x + b.width && a.y + a.height >= b.y && a.y <= b.y + b.height;
}

function cardsIntersectingZone(cards: HTMLElement[], zone: HTMLElement, sourceByCardId: Map<string, LedgerGeometry>, zoneGeometry: LedgerGeometry): HTMLElement[] {
  return cards.filter((card) => {
    const cardId = card.dataset.cardId ?? '';
    const cardGeometry = sourceByCardId.get(cardId);
    return Boolean(cardGeometry && geometriesIntersect(cardGeometry, zoneGeometry));
  });
}

function selectedZoneCardMap(cards: HTMLElement[], zones: HTMLElement[], sourceByCardId: Map<string, LedgerGeometry>): Map<string, HTMLElement[]> {
  const ledgerAnnotations = activeLedgerAnnotationMap();
  return new Map(zones.map((zone) => {
    const zoneId = zone.dataset.zoneId ?? '';
    return [zoneId, cardsIntersectingZone(cards, zone, sourceByCardId, sourceZoneGeometry(zone, ledgerAnnotations))];
  }));
}

function expandSelectedZonesToCards(cardsByZoneId: Map<string, HTMLElement[]>, zones: HTMLElement[], sourceByCardId: Map<string, LedgerGeometry>, measuredGeometry: ResizedCardGeometry): ResizedCardGeometry {
  if (zones.length === 0 || cardsByZoneId.size === 0) return {};
  const geometry: ResizedCardGeometry = {};

  for (const zone of zones) {
    const zoneId = zone.dataset.zoneId ?? '';
    const containedCards = cardsByZoneId.get(zoneId) ?? [];
    if (!zoneId || containedCards.length === 0) continue;
    const next = resizeZoneGeometryToContainedCards(containedCards.map((card) => {
      const cardId = card.dataset.cardId ?? '';
      return measuredGeometry[cardId] ?? sourceByCardId.get(cardId) ?? sourceCardGeometry(card);
    }));
    if (!next) continue;
    const renderedGeometry = state.activeLedger ? renderGeometry(next) : next;
    zone.style.left = `${renderedGeometry.x}px`;
    zone.style.top = `${renderedGeometry.y}px`;
    zone.style.width = `${renderedGeometry.width}px`;
    zone.style.height = `${renderedGeometry.height}px`;
    geometry[zoneId] = next;
  }

  return geometry;
}

export function resizeSelectedCardsToContent(): ResizeToContentGeometry {
  const selectedCards = selectedCardElements();
  const zones = selectedZoneElements();
  if (selectedCards.length === 0 && zones.length === 0) {
    telemetry('resize-selected-cards', { count: 0 });
    return { cards: {}, zones: {} };
  }

  const ledgerCards = activeLedgerCardMap();
  const allCards = allCardElements();
  const sourceByCardId = new Map(allCards.map((card) => [card.dataset.cardId ?? '', sourceCardGeometry(card, ledgerCards)]));
  const cardsByZoneId = selectedZoneCardMap(allCards, zones, sourceByCardId);
  const cards = uniqueCards([...selectedCards, ...Array.from(cardsByZoneId.values()).flat()]);
  const detail = clearLowDetailForMeasurement();
  const restoreForcedDetails = forceCardDetailsForMeasurement(cards.map((card) => card.dataset.cardId ?? ''));
  let result: ResizeToContentGeometry = { cards: {}, zones: {} };
  try {
    const measured = cards.map((card) => {
      const sourceGeometry = sourceByCardId.get(card.dataset.cardId ?? '') ?? sourceCardGeometry(card, ledgerCards);
      const height = measureNaturalCardHeight(card, sourceGeometry.width);
      return {
        id: card.dataset.cardId ?? '',
        left: sourceGeometry.x,
        top: sourceGeometry.y,
        width: Math.ceil(sourceGeometry.width),
        height
      };
    });
    const arranged = resolveCardYOverlap(measured);
    const byId = new Map(cards.map((card) => [card.dataset.cardId ?? '', card]));
    const geometry: ResizedCardGeometry = {};

    for (const record of arranged) {
      const card = byId.get(record.id);
      if (!card) continue;
      applyCardBox(card, { x: record.left, y: record.top, width: record.width, height: record.height });
      geometry[record.id] = { x: record.left, y: record.top, width: record.width, height: record.height };
    }
    const resizedZones = expandSelectedZonesToCards(cardsByZoneId, zones, sourceByCardId, geometry);
    result = { cards: geometry, zones: resizedZones };
  } finally {
    restoreDetailClasses(detail);
    restoreForcedDetails();
  }
  renderRelationshipOverlay();
  if (Object.keys(result.zones).length > 0) renderZoneLabelOverlay();
  telemetry('resize-selected-cards', { count: Object.keys(result.cards).length, cardIds: Object.keys(result.cards), zoneIds: Object.keys(result.zones) });
  return result;
}
