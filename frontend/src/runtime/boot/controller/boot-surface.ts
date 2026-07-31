/**
 * WHAT: Boots the browser surface from route, persisted, ledger, and input state.
 * WHY: Request scoping and visible state must be established before subscriptions and rendering begin.
 */
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
import { installFrontendTelemetryWebSocket } from '../../telemetry/effect/frontend-telemetry-websocket.js';
import { installProjectRequestScope, replicaNodeIdFromLocation } from '../../project/helper/project-request-scope.js';
import { routeScope } from '../../navigation/helper/route-scope.js';
import { selectThread } from '../../thread/effect/select-thread.js';
import { openThreadPanel } from '../../thread/effect/open-thread-panel.js';
import { hydrateThreadViewportState } from '../../thread/effect/persist-thread-scroll.js';

export function bootSurface(): void {
  installProjectRequestScope();
  void installFrontendTelemetryWebSocket();
  const persisted = readPersistedState();
  hydrateThreadViewportState(persisted);
  const scope = routeScope(window.location.pathname);
  state.projectId = scope.projectId;
  state.replicaNodeId = replicaNodeIdFromLocation();
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
    void loadDecisionOsState().then(loadActiveLedgerState).then(() => {
      // WHAT: Materialize a canonical card deep link after its ledger has loaded.
      // WHY: Desktop card URLs must open the same resource identity that compact routes render directly.
      if (scope.view === 'card' && scope.cardId && state.activeLedger?.cards?.some((card: Record<string, unknown>) => String(card.id ?? '') === scope.cardId)) {
        state.selection = { cardIds: [scope.cardId], zoneIds: [], groupIds: [] };
        selectThread(`thread-${scope.cardId}`);
        openThreadPanel();
      }
      renderCanvasSurface();
    });
  }
  renderCanvasSurface();
  renderThreadPanel();
}
