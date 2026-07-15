/**
 * WHAT: Opens a real ledger from the parent ledgers canvas.
 * WHY: Overview zoom-in navigation should land at canonical min-scale centered framing.
 */
import { canvas } from '../../dom.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import {
  advanceLedgerRouteEpoch,
  restoreLedgerReconciliationRoute,
  snapshotLedgerReconciliationRoute
} from '../../ledger/effect/reconcile-active-ledger-state.js';
import { minScaleCenteredLedgerViewport } from '../../ledger/helper/min-scale-centered-ledger-viewport.js';
import { activeLedgers } from '../../ledger/helper/active-ledgers.js';
import { renderTabRegistry } from '../effect/render-tab-registry.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function enterLedgerController(ledgerId: string, options: { replace?: boolean; canonicalMinScale?: boolean } = {}): Promise<void> {
  if (!activeLedgers().some((ledger) => ledger.id === ledgerId)) return;
  const previousRoute = { canvasMode: state.canvasMode, activeTab: state.activeTab };
  const reconciliationSnapshot = snapshotLedgerReconciliationRoute();
  const navigationEpoch = advanceLedgerRouteEpoch(ledgerId);
  state.canvasMode = 'ledger';
  state.activeTab = ledgerId;
  const loaded = await loadActiveLedgerState({
    activeTab: ledgerId,
    canvasMode: 'ledger',
    endpoint: `/api/ledgers/${encodeURIComponent(ledgerId)}/canvas`,
    ledgerStateId: ledgerId
  });
  if (!loaded) {
    const navigationIsCurrent = state.ledgerReconciliation.routeEpoch === navigationEpoch
      && state.ledgerReconciliation.routeLedgerStateId === ledgerId;
    if (navigationIsCurrent) {
      state.canvasMode = previousRoute.canvasMode;
      state.activeTab = previousRoute.activeTab;
      restoreLedgerReconciliationRoute(reconciliationSnapshot);
    }
    return;
  }
  if (options.canonicalMinScale !== false) {
    const rect = canvas?.getBoundingClientRect?.() ?? { width: window.innerWidth, height: window.innerHeight };
    const viewport = minScaleCenteredLedgerViewport({ ledger: state.activeLedger, canvasSize: { width: rect.width, height: rect.height }, scale: 0.03 });
    Object.assign(state.viewport, viewport);
    state.viewports = { ...(state.viewports ?? {}), [ledgerId]: { ...viewport } };
  }
  if (options.replace) history.replaceState?.({}, '', `/${ledgerId}`);
  else if (window.location.pathname !== `/${ledgerId}`) history.pushState?.({}, '', `/${ledgerId}`);
  canvas.classList.remove('ledgers-canvas-mode');
  renderTabRegistry();
  renderCanvasSurface();
  telemetry('enter-ledger-controller', { ledgerId, canonicalMinScale: options.canonicalMinScale !== false });
}
