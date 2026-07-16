/**
 * WHAT: Browser runtime entrypoint for the decision-os canvas surface.
 * WHY: Runtime behavior is split by domain and role so implementation stays aligned with the ledger convention.
 */
import { bootSurface } from './boot/controller/boot-surface.js';
import { state } from './state.js';
import { scheduleCanvasMediaOverlayRender } from './canvas/effect/render-canvas-media-overlay.js';
import { renderCanvasControlOverlay } from './canvas/effect/render-canvas-control-overlay.js';
import { renderCanvasSurface } from './canvas/effect/render-canvas-surface.js';
import { installCanvasSurfaceEffects } from './surface/effect/canvas-surface-effects.js';

declare global {
  interface Window {
    __coreState: Record<string, unknown>;
    __coreTelemetry: unknown[];
  }
}

window.__coreState = state;
window.__coreTelemetry = [];
installCanvasSurfaceEffects({
  renderCanvasControlOverlay,
  renderCanvasSurface,
  scheduleCanvasMediaOverlayRender,
});
bootSurface();
