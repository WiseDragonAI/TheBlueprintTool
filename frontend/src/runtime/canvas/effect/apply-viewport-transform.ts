import { canvas, content } from '../../dom.js';
import { state } from '../../state.js';
import { renderCanvasControlOverlay } from './render-canvas-control-overlay.js';
import { renderLedgersIndicator } from './render-ledgers-indicator.js';
import { canvasMediaOverlayScaleThreshold, clearCanvasMediaOverlay, scheduleCanvasMediaOverlayRender } from './render-canvas-media-overlay.js';
import { syncViewportCardDetails } from './sync-viewport-card-details.js';
import { updateDetailMode } from './update-detail-mode.js';
import { effectiveViewportScale } from '../helper/render-density.js';
import { renderCanvasDebugOverlay } from '../../debug/effect/render-canvas-debug-overlay.js';

const viewportTransformTransition = 'transform 90ms cubic-bezier(0.22, 0.61, 0.36, 1)';

function applyViewportScaleCssVars(): void {
  const scale = effectiveViewportScale();
  const viewportScale = String(scale);
  const inverseViewportScale = String(1 / scale);
  if (canvas.style.getPropertyValue('--viewport-scale') !== viewportScale) canvas.style.setProperty('--viewport-scale', viewportScale);
  if (canvas.style.getPropertyValue('--inverse-viewport-scale') !== inverseViewportScale) canvas.style.setProperty('--inverse-viewport-scale', inverseViewportScale);
}

function applyViewportTransformTransition(animated: boolean): void {
  const transition = animated ? viewportTransformTransition : 'none';
  if (content.style.transition !== transition) content.style.transition = transition;
}

export function applyViewportSettledEffects(): void {
  applyViewportScaleCssVars();
  updateDetailMode();
  syncViewportCardDetails();
  scheduleCanvasMediaOverlayRender();
  renderCanvasControlOverlay();
  renderLedgersIndicator();
}

export function applyViewportTransform(settled = true, animated = false): void {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const x = Math.round(state.viewport.x * devicePixelRatio) / devicePixelRatio;
  const y = Math.round(state.viewport.y * devicePixelRatio) / devicePixelRatio;
  applyViewportTransformTransition(animated);
  content.style.transform = `translate(${x}px, ${y}px) scale(${effectiveViewportScale()})`;
  if (!settled || Number(state.viewport.scale) < canvasMediaOverlayScaleThreshold) clearCanvasMediaOverlay();
  if (settled) applyViewportSettledEffects();
  renderCanvasDebugOverlay(settled ? 'viewport-settled' : 'viewport-frame');
}
