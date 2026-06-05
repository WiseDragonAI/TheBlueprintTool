/**
 * WHAT: Applies the current viewport transform to canvas CSS and content.
 * WHY: Zoom and pan must keep world transform exact while low-detail label CSS updates stay bounded.
 */
import { canvas, content } from '../../dom.js';
import { state } from '../../state.js';
import { resolveDetailModeCssScale } from '../helper/resolve-detail-mode-css-scale.js';
import { renderCanvasControlOverlay } from './render-canvas-control-overlay.js';
import { scheduleCanvasMediaOverlayRender } from './render-canvas-media-overlay.js';
import { updateDetailMode } from './update-detail-mode.js';

export function applyViewportTransform(): void {
  const cssScale = resolveDetailModeCssScale(state.viewport.scale, state.viewport.scale < 0.35);
  const viewportScale = String(cssScale.viewportScale);
  const inverseViewportScale = String(cssScale.inverseViewportScale);
  if (canvas.style.getPropertyValue('--viewport-scale') !== viewportScale) {
    // Branch: Avoid invalidating all counter-scaled labels when the low-detail bucket did not change.
    canvas.style.setProperty('--viewport-scale', viewportScale);
  }
  if (canvas.style.getPropertyValue('--inverse-viewport-scale') !== inverseViewportScale) {
    // Branch: Avoid repeated raster work from identical inverse-scale CSS variable writes.
    canvas.style.setProperty('--inverse-viewport-scale', inverseViewportScale);
  }
  updateDetailMode();
  const devicePixelRatio = window.devicePixelRatio || 1;
  const x = Math.round(state.viewport.x * devicePixelRatio) / devicePixelRatio;
  const y = Math.round(state.viewport.y * devicePixelRatio) / devicePixelRatio;
  content.style.transform = `translate(${x}px, ${y}px) scale(${state.viewport.scale})`;
  scheduleCanvasMediaOverlayRender();
  renderCanvasControlOverlay();
}
