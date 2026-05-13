/**
 * WHAT: Browser runtime entrypoint for the CoreV2 canvas surface.
 * WHY: Runtime behavior is split by domain and role so implementation stays aligned with the ledger convention.
 */
import { bootSurface } from './boot/controller/boot-surface.js';
import { state } from './state.js';

declare global {
  interface Window {
    __coreState: Record<string, unknown>;
    __coreTelemetry: unknown[];
  }
}

window.__coreState = state;
window.__coreTelemetry = [];

bootSurface();
