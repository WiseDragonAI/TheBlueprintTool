import { rectanglesIntersect } from '../../canvas/helper/rectangles-intersect.js';
import { elementCanvasRect } from '../../canvas/helper/element-canvas-rect.js';
import { state } from '../../state.js';

type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type LedgerEntry = Record<string, unknown>;

function numeric(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ledgerCardRect(card: LedgerEntry): CanvasRect {
  const left = numeric(card.x, 0);
  const top = numeric(card.y, 0);
  const width = Math.max(220, numeric(card.w ?? card.width, 280));
  const height = Math.max(132, numeric(card.h ?? card.height, 132));
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function ledgerZoneRect(zone: LedgerEntry): CanvasRect {
  const left = numeric(zone.x, 0);
  const top = numeric(zone.y, 0);
  const width = Math.max(180, numeric(zone.width ?? zone.w, 280));
  const height = Math.max(120, numeric(zone.height ?? zone.h, 180));
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function cardsIntersectingLedgerZone(zoneId: string): string[] | null {
  const ledger = state.activeLedger as { cards?: unknown; annotations?: unknown } | null;
  const cards = Array.isArray(ledger?.cards) ? ledger.cards as LedgerEntry[] : null;
  const annotations = Array.isArray(ledger?.annotations) ? ledger.annotations as LedgerEntry[] : null;
  if (!cards || !annotations) return null;
  const zone = annotations.find((entry) => String(entry.id ?? '') === zoneId);
  if (!zone) return null;
  const zoneRect = ledgerZoneRect(zone);
  const intersecting: string[] = [];
  for (const card of cards) {
    const cardId = String(card.id ?? '');
    if (!cardId) continue;
    const cardRect = ledgerCardRect(card);
    if (cardRect.left >= zoneRect.right || cardRect.right <= zoneRect.left) continue;
    if (rectanglesIntersect(zoneRect, cardRect)) intersecting.push(cardId);
  }
  return intersecting;
}

function parsePixelValue(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function elementStyleCanvasRect(element: HTMLElement): CanvasRect {
  const left = parsePixelValue(element.style.left);
  const top = parsePixelValue(element.style.top);
  const width = parsePixelValue(element.style.width);
  const height = parsePixelValue(element.style.height) ?? parsePixelValue(element.style.minHeight);
  if (left === null || top === null || width === null || height === null) return elementCanvasRect(element);
  return { left, top, right: left + width, bottom: top + height, width, height };
}

export function cardsIntersectingZone(zoneId: string): string[] {
  const ledgerCards = cardsIntersectingLedgerZone(zoneId);
  if (ledgerCards) return ledgerCards;
  const zone = document.querySelector(`[data-zone-id="${CSS.escape(zoneId)}"]`) as HTMLElement | null;
  if (!zone) return [];
  const zoneRect = elementStyleCanvasRect(zone);
  const intersecting: string[] = [];
  for (const card of document.querySelectorAll('.card[data-card-id]')) {
    const element = card as HTMLElement;
    const cardId = element.dataset.cardId;
    if (!cardId) continue;
    const cardRect = elementStyleCanvasRect(element);
    if (cardRect.left >= zoneRect.right || cardRect.right <= zoneRect.left) continue;
    if (rectanglesIntersect(zoneRect, cardRect)) intersecting.push(cardId);
  }
  return intersecting;
}
