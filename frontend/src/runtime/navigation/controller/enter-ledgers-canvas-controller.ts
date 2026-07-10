/**
 * WHAT: Enters the `/ledgers` parent canvas mode.
 * WHY: Header, toolbox, wheel, and browser navigation should share one overview entry path.
 */
import { canvas } from '../../dom.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import { advanceLedgerRouteEpoch, restoreLedgerReconciliationRoute, snapshotLedgerReconciliationRoute } from '../../ledger/effect/reconcile-active-ledger-state.js';
import { renderTabRegistry } from '../effect/render-tab-registry.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function enterLedgersCanvasController(options: { replace?: boolean } = {}): Promise<void> {
  state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...state.viewport } };
  persistState();
  const previousCanvasMode = state.canvasMode;
  const reconciliationSnapshot = snapshotLedgerReconciliationRoute();
  const navigationEpoch = advanceLedgerRouteEpoch('ledgers-canvas');
  state.canvasMode = 'ledgers';
  const loaded = await loadActiveLedgerState({
    canvasMode: 'ledgers',
    endpoint: '/decision-os/ledgers-canvas',
    ledgerStateId: 'ledgers-canvas'
  });
  if (!loaded) {
    const navigationIsCurrent = state.ledgerReconciliation.routeEpoch === navigationEpoch
      && state.ledgerReconciliation.routeLedgerStateId === 'ledgers-canvas';
    if (navigationIsCurrent) {
      state.canvasMode = previousCanvasMode;
      restoreLedgerReconciliationRoute(reconciliationSnapshot);
    }
    return;
  }
  if (options.replace) history.replaceState?.({}, '', '/ledgers');
  else if (window.location.pathname !== '/ledgers') history.pushState?.({}, '', '/ledgers');
  canvas.classList.add('ledgers-canvas-mode');
  renderTabRegistry();
  renderCanvasSurface();
  telemetry('enter-ledgers-canvas-controller', { activeTab: state.activeTab });
}
