/**
 * WHAT: Enters the global registered-projects canvas.
 * WHY: The canvas hierarchy needs one canonical parent above every project's ledgers canvas.
 */
import { canvas } from '../../dom.js';
import { state } from '../../state.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import { advanceLedgerRouteEpoch, restoreLedgerReconciliationRoute, snapshotLedgerReconciliationRoute } from '../../ledger/effect/reconcile-active-ledger-state.js';

export async function enterProjectsCanvasController(options: { replace?: boolean } = {}): Promise<void> {
  const previousCanvasMode = state.canvasMode;
  const reconciliationSnapshot = snapshotLedgerReconciliationRoute();
  const navigationEpoch = advanceLedgerRouteEpoch('projects-canvas');
  state.canvasMode = 'projects';
  const loaded = await loadActiveLedgerState({
    canvasMode: 'projects',
    endpoint: '/decision-os/projects-canvas',
    ledgerStateId: 'projects-canvas',
  });
  // WHAT: Restore the preceding scope only when this failed request still owns navigation.
  // WHY: A slower failed transition must not replace a newer successful route.
  if (!loaded) {
    const navigationIsCurrent = state.ledgerReconciliation.routeEpoch === navigationEpoch
      && state.ledgerReconciliation.routeLedgerStateId === 'projects-canvas';
    if (navigationIsCurrent) {
      state.canvasMode = previousCanvasMode;
      restoreLedgerReconciliationRoute(reconciliationSnapshot);
    }
    return;
  }
  if (options.replace) history.replaceState?.({}, '', '/projects-canvas');
  else if (window.location.pathname !== '/projects-canvas') history.pushState?.({}, '', '/projects-canvas');
  canvas.classList.remove('ledgers-canvas-mode');
  canvas.classList.add('projects-canvas-mode');
  renderCanvasSurface();
}
