/**
 * WHAT: Browser runtime entrypoint for the decision-os canvas surface.
 * WHY: Runtime behavior is split by domain and role so implementation stays aligned with the ledger convention.
 */
import { bootSurface } from './boot/controller/boot-surface.js';
import { state } from './state.js';
import { routeScope } from './navigation/helper/route-scope.js';
import { bootApplication } from '../app/controller/boot-application.js';

declare global {
  interface Window {
    __coreState: Record<string, unknown>;
    __coreTelemetry: unknown[];
  }
}

window.__coreState = state;
window.__coreTelemetry = [];

const scope = routeScope(window.location.pathname);
const wideCanvas = window.matchMedia?.('(min-width: 761px)').matches !== false;
const canvasRoute = scope.view === 'projects'
  || Boolean(scope.projectId && ['ledgers', 'ledger'].includes(scope.view));
if (wideCanvas && canvasRoute) bootSurface();
else void bootApplication();
