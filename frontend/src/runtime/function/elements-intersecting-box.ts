import { rectanglesIntersect } from './rectangles-intersect.js';

export function elementsIntersectingBox(box: HTMLElement, selector: string, key: string): string[] {
  const boxRect = box.getBoundingClientRect();
  return Array.from(document.querySelectorAll(selector))
    .filter((node) => node !== box)
    .filter((node) => rectanglesIntersect(boxRect, (node as HTMLElement).getBoundingClientRect()))
    .map((node) => (node as HTMLElement).dataset[key])
    .filter(Boolean) as string[];
}
