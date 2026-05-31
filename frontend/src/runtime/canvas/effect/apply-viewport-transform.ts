import { canvas, content } from '../../dom.js';
import { state } from '../../state.js';
import { renderCanvasControlOverlay } from './render-canvas-control-overlay.js';
import { updateDetailMode } from './update-detail-mode.js';

export function applyViewportTransform(): void {
  canvas.style.setProperty('--viewport-scale', String(state.viewport.scale));
  canvas.style.setProperty('--inverse-viewport-scale', String(1 / state.viewport.scale));
  updateDetailMode();
  const devicePixelRatio = window.devicePixelRatio || 1;
  const x = Math.round(state.viewport.x * devicePixelRatio) / devicePixelRatio;
  const y = Math.round(state.viewport.y * devicePixelRatio) / devicePixelRatio;
  content.style.transform = `translate(${x}px, ${y}px) scale(${state.viewport.scale})`;
  renderCanvasControlOverlay();
}
