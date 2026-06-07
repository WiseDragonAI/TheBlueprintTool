/**
 * WHAT: Coalesces wheel viewport updates and owns the short zoom-detail settle state.
 * WHY: Wheel bursts should update transform once per frame, then reconcile detail mode after input settles.
 */
import { applyViewportSettledEffects, applyViewportTransform } from './apply-viewport-transform.js';
import { hideCanvasControlOverlay } from './render-canvas-control-overlay.js';
import { syncRenderDensity } from '../helper/render-density.js';
import { renderLedgerSurface } from '../../ledger/effect/render-ledger-surface.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderSelectionState } from '../../selection/effect/render-selection-state.js';
import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';

let frame = 0;
let settleTimer: ReturnType<typeof setTimeout> | 0 = 0;
let frameSettled = true;
let frameAnimated = false;

function nextFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback);
  else setTimeout(callback, 0);
}

function finishZoomSettle(): void {
  settleTimer = 0;
  applyViewportSettledEffects();
}

export function scheduleViewportTransform(zooming = true): void {
  if (zooming) {
    hideCanvasControlOverlay();
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(finishZoomSettle, 120);
  }
  frameSettled = frameSettled && !zooming;
  frameAnimated = frameAnimated || zooming;
  if (frame) return;
  nextFrame(() => {
    frame = 0;
    const densityChanged = syncRenderDensity();
    if (densityChanged) {
      renderLedgerSurface();
      renderSelectionState();
      renderZoneLabelOverlay();
      renderRelationshipOverlay();
    }
    const settled = frameSettled;
    const animated = frameAnimated && !densityChanged;
    frameSettled = true;
    frameAnimated = false;
    applyViewportTransform(settled, animated);
  });
  frame = 1;
}
