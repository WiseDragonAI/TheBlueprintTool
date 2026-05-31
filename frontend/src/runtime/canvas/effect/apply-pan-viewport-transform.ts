/**
 * WHAT: Applies a pan-only viewport transform without recalculating scale-driven detail mode.
 * WHY: Canvas drag pan must stay cheap because low-detail state only changes when scale changes.
 */
import { content } from '../../dom.js';
import { state } from '../../state.js';
import { renderCanvasControlOverlay } from './render-canvas-control-overlay.js';

export function applyPanViewportTransform(): void {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const x = Math.round(state.viewport.x * devicePixelRatio) / devicePixelRatio;
  const y = Math.round(state.viewport.y * devicePixelRatio) / devicePixelRatio;
  content.style.transform = `translate(${x}px, ${y}px) scale(${state.viewport.scale})`;
  renderCanvasControlOverlay();
}
