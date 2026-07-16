/**
 * WHAT: Reloads persisted runtime and authoritative ledger state for the active route.
 * WHY: Manual refresh must preserve live viewport and pointer continuity while accepting server data.
 */
import { state } from '../../state.js';
import { hydratePersistedGeometry } from '../../persistence/effect/hydrate-persisted-geometry.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import { advanceLedgerRouteEpoch } from '../../ledger/effect/reconcile-active-ledger-state.js';
import { readPersistedState } from '../../persistence/helper/read-persisted-state.js';
import { renderCanvasSurface } from '../../surface/effect/canvas-surface-effects.js';
import { renderTabRegistry } from '../../navigation/effect/render-tab-registry.js';
import { routeCanvasMode } from '../../navigation/helper/route-canvas-mode.js';
import { routeTab } from '../../navigation/helper/route-tab.js';
import { applyRailCollapsedState } from '../../toolbox/effect/apply-rail-collapsed-state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { routeScope } from '../../navigation/helper/route-scope.js';

export async function refreshRuntimeState(): Promise<void> {
  telemetry('subscribe-server-refresh', { specId: '50000006', source: 'refresh-button' });
  const nextCanvasMode = routeCanvasMode(window.location.pathname);
  const nextScope = routeScope(window.location.pathname);
  state.projectId = nextScope.projectId;
  const nextActiveTab = nextCanvasMode === 'ledger' ? routeTab(window.location.pathname) : state.activeTab;
  const nextLedgerStateId = nextCanvasMode === 'projects' ? 'projects-canvas' : nextCanvasMode === 'ledgers' ? 'ledgers-canvas' : nextActiveTab;
  const localViewport = state.activeLedger && state.activeLedgerId === nextLedgerStateId ? { ...state.viewport } : null;
  const persisted = readPersistedState();
  state.canvasMode = nextCanvasMode;
  if (state.canvasMode === 'ledger') state.activeTab = nextActiveTab;
  if (state.ledgerReconciliation.routeLedgerStateId !== nextLedgerStateId) advanceLedgerRouteEpoch(nextLedgerStateId);
  state.viewports = persisted.viewports && typeof persisted.viewports === 'object' ? persisted.viewports : state.viewports;
  if (localViewport) {
    Object.assign(state.viewport, localViewport);
    if (state.canvasMode === 'ledger') state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...localViewport } };
  } else if (state.canvasMode === 'ledger') Object.assign(state.viewport, state.viewports?.[state.activeTab] ?? persisted.viewport ?? { x: 0, y: 0, scale: 1 });
  applyRailCollapsedState(persisted.railCollapsed === true);
  hydratePersistedGeometry(persisted.geometry);
  const applied = await loadActiveLedgerState({ activeTab: nextActiveTab, canvasMode: nextCanvasMode, ledgerStateId: nextLedgerStateId });
  telemetry('load-ledger-state', { specId: '50000006', restored: Boolean(persisted.geometry || persisted.viewport), applied });
  if (!applied) return;
  telemetry('merge-refresh-state', { specId: '50000006', source: 'refresh-button' });
  renderTabRegistry();
  renderCanvasSurface();
}
