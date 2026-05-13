import { rectanglesIntersect } from '../../canvas/helper/rectangles-intersect.js';
import { elementCanvasRect } from '../../canvas/helper/element-canvas-rect.js';

type CanvasRect = { x: number; y: number; width: number; height: number };

export function elementsIntersectingCanvasRect(rect: CanvasRect, selector: string, key: string): string[] {
  const bounds = { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height };
  return Array.from(document.querySelectorAll(selector))
    .filter((node) => {
      const element = node as HTMLElement;
      return rectanglesIntersect(bounds, elementCanvasRect(element));
    })
    .map((node) => (node as HTMLElement).dataset[key])
    .filter(Boolean) as string[];
}
