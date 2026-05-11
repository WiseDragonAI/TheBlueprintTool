/**
 * WHAT: Browser runtime entrypoint for the CoreV2 canvas surface.
 * WHY: Runtime behavior lives in one-function files so implementation stays aligned with the ledger convention.
 */
import { bootSurface } from './function/boot-surface.js';
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
