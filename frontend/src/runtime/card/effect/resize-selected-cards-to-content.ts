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

const zoneFitPadding = 96;

type DetailClasses = {
  low: boolean;
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

function clearLowDetailForMeasurement(): DetailClasses {
  const detail = {
    low: canvas.classList.contains('low-detail')
  };
  if (detail.low) canvas.classList.remove('low-detail');
  return detail;
}

function restoreDetailClasses(detail: DetailClasses): void {
  canvas.classList.toggle('low-detail', detail.low);
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

function selectedZoneCardMap(cards: HTMLElement[], zones = selectedZoneElements()): Map<string, HTMLElement[]> {
  return new Map(zones.map((zone) => [zone.dataset.zoneId ?? '', cardsIntersectingZone(cards, zone)]));
}

function expandSelectedZonesToCards(cardsByZoneId: Map<string, HTMLElement[]>, zones = selectedZoneElements()): ResizedCardGeometry {
  if (zones.length === 0 || cardsByZoneId.size === 0) return {};
  const geometry: ResizedCardGeometry = {};

  for (const zone of zones) {
    const zoneId = zone.dataset.zoneId ?? '';
    const containedCards = cardsByZoneId.get(zoneId) ?? [];
    if (!zoneId || containedCards.length === 0) continue;
    const next = resizeZoneGeometryToContainedCards(containedCards.map((card) => ({
      x: card.offsetLeft,
      y: card.offsetTop,
      width: card.offsetWidth,
      height: card.offsetHeight
    })));
    if (!next) continue;
    zone.style.left = `${next.x}px`;
    zone.style.top = `${next.y}px`;
    zone.style.width = `${next.width}px`;
    zone.style.height = `${next.height}px`;
    geometry[zoneId] = next;
  }

  return geometry;
}

export function resizeSelectedCardsToContent(): ResizeToContentGeometry {
  const cards = selectedCardElements();
  const zones = selectedZoneElements();
  if (cards.length === 0 && zones.length === 0) {
    telemetry('resize-selected-cards', { count: 0 });
    return { cards: {}, zones: {} };
  }

  const detail = clearLowDetailForMeasurement();
  try {
    const zoneSourceCards = cards.length > 0 ? cards : allCardElements();
    const cardsByZoneId = selectedZoneCardMap(zoneSourceCards, zones);
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
    const resizedZones = expandSelectedZonesToCards(cardsByZoneId, zones);

    renderRelationshipOverlay();
    if (Object.keys(resizedZones).length > 0) renderZoneLabelOverlay();
    telemetry('resize-selected-cards', { count: arranged.length, cardIds: arranged.map((card) => card.id), zoneIds: Object.keys(resizedZones) });
    return { cards: geometry, zones: resizedZones };
  } finally {
    restoreDetailClasses(detail);
  }
}
