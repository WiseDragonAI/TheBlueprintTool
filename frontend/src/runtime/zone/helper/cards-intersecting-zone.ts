import { rectanglesIntersect } from '../../canvas/helper/rectangles-intersect.js';

export function cardsIntersectingZone(zoneId: string): string[] {
  const zone = document.querySelector(`[data-zone-id="${zoneId}"]`) as HTMLElement | null;
  if (!zone) return [];
  const zoneRect = zone.getBoundingClientRect();
  return Array.from(document.querySelectorAll('[data-card-id]'))
    .filter((card) => rectanglesIntersect(zoneRect, (card as HTMLElement).getBoundingClientRect()))
    .map((card) => (card as HTMLElement).dataset.cardId)
    .filter(Boolean) as string[];
}
