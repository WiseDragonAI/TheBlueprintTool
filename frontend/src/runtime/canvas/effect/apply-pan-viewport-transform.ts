/**
 * WHAT: Applies a pan-only viewport transform without recalculating scale-driven detail mode.
 * WHY: Canvas drag pan must stay cheap because low-detail state only changes when scale changes.
 */
import { content } from '../../dom.js';
import { state } from '../../state.js';
import { applyCanvasMediaOverlayPanTransform } from './render-canvas-media-overlay.js';
import { renderZoomDebugOverlay } from '../../debug/zoom-debug/effect/render-zoom-debug-overlay.js';
import { scheduleMountedLedgerCardDetailsSync } from '../../card/detail-mount/schedule-mounted-ledger-card-details-sync.js';

export function applyPanViewportTransform(): void {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const x = Math.round(state.viewport.x * devicePixelRatio) / devicePixelRatio;
  const y = Math.round(state.viewport.y * devicePixelRatio) / devicePixelRatio;
  content.style.transform = `translate(${x}px, ${y}px) scale(${state.viewport.scale})`;
  applyCanvasMediaOverlayPanTransform();
  scheduleMountedLedgerCardDetailsSync();
  renderZoomDebugOverlay();
}
