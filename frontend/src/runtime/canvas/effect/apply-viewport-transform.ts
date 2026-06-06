import { canvas, content } from '../../dom.js';
import { state } from '../../state.js';
import { renderCanvasControlOverlay } from './render-canvas-control-overlay.js';
import { canvasMediaOverlayScaleThreshold, clearCanvasMediaOverlay, scheduleCanvasMediaOverlayRender } from './render-canvas-media-overlay.js';
import { syncViewportCardDetails } from './sync-viewport-card-details.js';
import { updateDetailMode } from './update-detail-mode.js';

function applyViewportScaleCssVars(): void {
  const viewportScale = String(state.viewport.scale);
  const inverseViewportScale = String(1 / state.viewport.scale);
  if (canvas.style.getPropertyValue('--viewport-scale') !== viewportScale) canvas.style.setProperty('--viewport-scale', viewportScale);
  if (canvas.style.getPropertyValue('--inverse-viewport-scale') !== inverseViewportScale) canvas.style.setProperty('--inverse-viewport-scale', inverseViewportScale);
}

export function applyViewportSettledEffects(): void {
  applyViewportScaleCssVars();
  updateDetailMode();
  syncViewportCardDetails();
  scheduleCanvasMediaOverlayRender();
  renderCanvasControlOverlay();
}

export function applyViewportTransform(settled = true): void {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const x = Math.round(state.viewport.x * devicePixelRatio) / devicePixelRatio;
  const y = Math.round(state.viewport.y * devicePixelRatio) / devicePixelRatio;
  content.style.transform = `translate(${x}px, ${y}px) scale(${state.viewport.scale})`;
  if (!settled || Number(state.viewport.scale) < canvasMediaOverlayScaleThreshold) clearCanvasMediaOverlay();
  if (settled) applyViewportSettledEffects();
}
