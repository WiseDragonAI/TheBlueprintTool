import { state } from '../../state.js';
import { SPEC_IMPLEMENTATION_SURFACE } from '../../spec-implementation-surface.js';
import { bindInputs } from '../../input/effect/bind-inputs.js';
import { hydratePersistedGeometry } from '../../persistence/effect/hydrate-persisted-geometry.js';
import { loadDecisionOsState } from '../../ledger/effect/load-decision-os-state.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import { readPersistedState } from '../../persistence/helper/read-persisted-state.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { renderTabRegistry } from '../../navigation/effect/render-tab-registry.js';
import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';
import { subscribeLedgerContentEvents } from '../../refresh/effect/subscribe-ledger-content-events.js';
import { routeCanvasMode } from '../../navigation/helper/route-canvas-mode.js';
import { routeTab } from '../../navigation/helper/route-tab.js';
import { applyRailCollapsedState } from '../../toolbox/effect/apply-rail-collapsed-state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { installProjectRequestScope } from '../../project/helper/project-request-scope.js';
import { routeScope } from '../../navigation/helper/route-scope.js';

export function bootSurface(): void {
  installProjectRequestScope();
  const persisted = readPersistedState();
  const scope = routeScope(window.location.pathname);
  state.projectId = scope.projectId;
  state.canvasMode = routeCanvasMode(window.location.pathname);
  state.activeTab = routeTab(window.location.pathname);
  state.activeLedgerId = state.activeTab;
  state.viewports = persisted.viewports && typeof persisted.viewports === 'object' ? persisted.viewports : state.viewports;
  const restoredViewport = state.canvasMode === 'ledgers' ? {} : state.viewports?.[state.activeTab] ?? persisted.viewport ?? {};
  Object.assign(state.viewport, restoredViewport);
  applyRailCollapsedState(persisted.railCollapsed === true);
  telemetry('browser-load', { routePath: state.routePath });
  telemetry('derive-route-state', { activeTab: state.activeTab });
  telemetry('load-ledger-state', { restored: Boolean(persisted.viewport) });
  telemetry('map-spec-implementation-surface', { specs: SPEC_IMPLEMENTATION_SURFACE.length });
  hydratePersistedGeometry(persisted.geometry);
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  telemetry('clear-transient-selection', { reason: 'boot' });
  bindInputs();
  if (state.canvasMode !== 'projects') subscribeLedgerContentEvents();
  renderTabRegistry();
  if (state.canvasMode === 'projects') {
    void loadActiveLedgerState({ canvasMode: 'projects', endpoint: '/decision-os/projects-canvas', ledgerStateId: 'projects-canvas' })
      .then(() => renderCanvasSurface());
  } else {
    void loadDecisionOsState().then(loadActiveLedgerState).then(() => renderCanvasSurface());
  }
  renderCanvasSurface();
  renderThreadPanel();
}
