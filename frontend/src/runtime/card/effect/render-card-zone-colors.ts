import { elementCanvasRect } from '../../canvas/helper/element-canvas-rect.js';
import { rectanglesIntersect } from '../../canvas/helper/rectangles-intersect.js';

export function renderCardZoneColors(): void {
  const zones = Array.from(document.querySelectorAll('.regular-zone[data-zone-id]')) as HTMLElement[];
  for (const card of Array.from(document.querySelectorAll('[data-card-id]')) as HTMLElement[]) {
    card.style.removeProperty('--card-zone-color');
    const cardRect = elementCanvasRect(card);
    for (const zone of zones) {
      if (!rectanglesIntersect(cardRect, elementCanvasRect(zone))) continue;
      card.style.setProperty('--card-zone-color', getComputedStyle(zone).getPropertyValue('--zone-color').trim());
      break;
    }
  }
}
