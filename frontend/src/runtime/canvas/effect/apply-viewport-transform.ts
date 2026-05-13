import { canvas, content } from '../../dom.js';
import { state } from '../../state.js';
import { updateDetailMode } from './update-detail-mode.js';

export function applyViewportTransform(): void {
  canvas.style.setProperty('--viewport-scale', String(state.viewport.scale));
  updateDetailMode();
  content.style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
}
