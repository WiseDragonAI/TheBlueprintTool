import { canvas } from '../../dom.js';

export function point(event: MouseEvent): { x: number; y: number } {
  const bounds = canvas.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}
