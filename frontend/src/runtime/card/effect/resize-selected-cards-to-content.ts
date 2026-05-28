import { canvas } from '../../dom.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { resolveCardYOverlap } from '../helper/resolve-card-y-overlap.js';

export type ResizedCardGeometry = Record<string, { x: number; y: number; width: number; height: number }>;

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

export function resizeSelectedCardsToContent(): ResizedCardGeometry {
  const cards = selectedCardElements();
  if (cards.length === 0) {
    telemetry('resize-selected-cards', { count: 0 });
    return {};
  }

  const detail = clearLowDetailForMeasurement();
  try {
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

    renderRelationshipOverlay();
    telemetry('resize-selected-cards', { count: arranged.length, cardIds: arranged.map((card) => card.id) });
    return geometry;
  } finally {
    restoreDetailClasses(detail);
  }
}
