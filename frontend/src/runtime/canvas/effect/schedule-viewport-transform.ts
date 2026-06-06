/**
 * WHAT: Coalesces wheel viewport updates and owns the short zoom-detail settle state.
 * WHY: Wheel bursts should update transform once per frame, then reconcile detail mode after input settles.
 */
import { applyViewportSettledEffects, applyViewportTransform } from './apply-viewport-transform.js';

let frame = 0;
let settleTimer: ReturnType<typeof setTimeout> | 0 = 0;
let frameSettled = true;

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
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(finishZoomSettle, 120);
  }
  frameSettled = frameSettled && !zooming;
  if (frame) return;
  nextFrame(() => {
    frame = 0;
    const settled = frameSettled;
    frameSettled = true;
    applyViewportTransform(settled);
  });
  frame = 1;
}
