import { rectanglesIntersect } from '../../canvas/helper/rectangles-intersect.js';
import { elementCanvasRect } from '../../canvas/helper/element-canvas-rect.js';

type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

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
