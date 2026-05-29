import { canvas } from '../../dom.js';
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

type DetailClasses = {
  low: boolean;
  overview: boolean;
};

function selectedCardElements(): HTMLElement[] {
  return Array.from(new Set(state.selection.cardIds))
    .map((id: string) => document.querySelector(`[data-card-id="${CSS.escape(id)}"]`) as HTMLElement | null)
    .filter((card): card is HTMLElement => Boolean(card && !card.hidden));
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

function measureNaturalCardHeight(card: HTMLElement): number {
  const previousHeight = card.style.height;
  const previousMinHeight = card.style.minHeight;
  card.style.height = 'auto';
  card.style.minHeight = '132px';
  syncCardTabFrameForMeasurement(card);
  const height = Math.max(132, Math.ceil(card.scrollHeight || card.getBoundingClientRect().height));
  card.style.height = previousHeight;
  card.style.minHeight = previousMinHeight;
  return height;
}

function applyCardBox(card: HTMLElement, top: number, height: number): void {
  const width = Math.ceil(card.offsetWidth);
  card.style.top = `${top}px`;
  card.style.width = `${width}px`;
  card.style.height = `${height}px`;
  card.style.removeProperty('min-height');
  card.dataset.sizeCacheWidth = String(width);
  card.dataset.sizeCacheHeight = String(height);
  card.style.setProperty('--card-size-cache-width', `${width}px`);
  card.style.setProperty('--card-size-cache-height', `${height}px`);
}

function selectedZoneElements(): HTMLElement[] {
  return Array.from(new Set(state.selection.zoneIds))
    .map((id: string) => document.querySelector(`[data-zone-id="${CSS.escape(id)}"]`) as HTMLElement | null)
    .filter((zone): zone is HTMLElement => Boolean(zone && !zone.hidden));
}

function cardsIntersectingZone(cards: HTMLElement[], zone: HTMLElement): HTMLElement[] {
  return cards.filter((card) => {
    const left = card.offsetLeft;
    const top = card.offsetTop;
    const right = left + card.offsetWidth;
    const bottom = top + card.offsetHeight;
    return right >= zone.offsetLeft && left <= zone.offsetLeft + zone.offsetWidth && bottom >= zone.offsetTop && top <= zone.offsetTop + zone.offsetHeight;
  });
}

function selectedZoneCardMap(cards: HTMLElement[]): Map<string, HTMLElement[]> {
  return new Map(selectedZoneElements().map((zone) => [zone.dataset.zoneId ?? '', cardsIntersectingZone(cards, zone)]));
}

function expandSelectedZonesToCards(cardsByZoneId: Map<string, HTMLElement[]>): ResizedCardGeometry {
  const zones = selectedZoneElements();
  if (zones.length === 0 || cardsByZoneId.size === 0) return {};
  const padding = 18;
  const geometry: ResizedCardGeometry = {};

  for (const zone of zones) {
    const zoneId = zone.dataset.zoneId ?? '';
    const containedCards = cardsByZoneId.get(zoneId) ?? [];
    if (!zoneId || containedCards.length === 0) continue;
    const minLeft = Math.min(zone.offsetLeft, ...containedCards.map((card) => card.offsetLeft - padding));
    const minTop = Math.min(zone.offsetTop, ...containedCards.map((card) => card.offsetTop - padding));
    const maxRight = Math.max(zone.offsetLeft + zone.offsetWidth, ...containedCards.map((card) => card.offsetLeft + card.offsetWidth + padding));
    const maxBottom = Math.max(zone.offsetTop + zone.offsetHeight, ...containedCards.map((card) => card.offsetTop + card.offsetHeight + padding));
    const width = Math.ceil(maxRight - minLeft);
    const height = Math.ceil(maxBottom - minTop);
    zone.style.left = `${Math.floor(minLeft)}px`;
    zone.style.top = `${Math.floor(minTop)}px`;
    zone.style.width = `${width}px`;
    zone.style.height = `${height}px`;
    geometry[zoneId] = { x: Math.floor(minLeft), y: Math.floor(minTop), width, height };
  }

  return geometry;
}

export function resizeSelectedCardsToContent(): ResizeToContentGeometry {
  const cards = selectedCardElements();
  if (cards.length === 0) {
    telemetry('resize-selected-cards', { count: 0 });
    return { cards: {}, zones: {} };
  }

  const detail = clearLowDetailForMeasurement();
  try {
    const cardsByZoneId = selectedZoneCardMap(cards);
    const measured = cards.map((card) => {
      const height = measureNaturalCardHeight(card);
      return {
        id: card.dataset.cardId ?? '',
        left: card.offsetLeft,
        top: card.offsetTop,
        width: Math.ceil(card.offsetWidth),
        height
      };
    });
    const arranged = resolveCardYOverlap(measured);
    const byId = new Map(cards.map((card) => [card.dataset.cardId ?? '', card]));
    const geometry: ResizedCardGeometry = {};

    for (const record of arranged) {
      const card = byId.get(record.id);
      if (!card) continue;
      applyCardBox(card, record.top, record.height);
      geometry[record.id] = { x: record.left, y: record.top, width: record.width, height: record.height };
    }
    const zones = expandSelectedZonesToCards(cardsByZoneId);

    renderRelationshipOverlay();
    if (Object.keys(zones).length > 0) renderZoneLabelOverlay();
    telemetry('resize-selected-cards', { count: arranged.length, cardIds: arranged.map((card) => card.id), zoneIds: Object.keys(zones) });
    return { cards: geometry, zones };
  } finally {
    restoreDetailClasses(detail);
  }
}
