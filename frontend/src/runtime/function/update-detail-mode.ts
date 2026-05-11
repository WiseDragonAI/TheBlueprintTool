import { canvas } from '../dom.js';
import { state } from '../state.js';

export function updateDetailMode(): void {
  canvas.classList.toggle('low-detail', state.viewport.scale < 0.35);
  canvas.classList.toggle('overview-detail', state.viewport.scale < 0.18);
}
