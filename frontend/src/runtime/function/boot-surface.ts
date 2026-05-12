import { state } from '../state.js';
import { SPEC_IMPLEMENTATION_SURFACE } from '../spec-implementation-surface.js';
import { bindInputs } from './bind-inputs.js';
import { hydratePersistedGeometry } from './hydrate-persisted-geometry.js';
import { loadBlueprinttoolState } from './load-blueprinttool-state.js';
import { loadActiveLedgerState } from './load-active-ledger-state.js';
import { readPersistedState } from './read-persisted-state.js';
import { renderCanvasSurface } from './render-canvas-surface.js';
import { renderTabRegistry } from './render-tab-registry.js';
import { renderThreadPanel } from './render-thread-panel.js';
import { routeTab } from './route-tab.js';
import { telemetry } from './telemetry.js';

export function bootSurface(): void {
  const persisted = readPersistedState();
  state.activeTab = routeTab(window.location.pathname);
  state.viewports = persisted.viewports && typeof persisted.viewports === 'object' ? persisted.viewports : state.viewports;
  const restoredViewport = state.viewports?.[state.activeTab] ?? persisted.viewport ?? {};
  Object.assign(state.viewport, restoredViewport);
  if (state.activeTab === 'surface') state.surfaceViewport = { ...state.viewport };
  telemetry('browser-load', { routePath: state.routePath });
  telemetry('derive-route-state', { activeTab: state.activeTab });
  telemetry('load-ledger-state', { restored: Boolean(persisted.viewport) });
  telemetry('map-spec-implementation-surface', { specs: SPEC_IMPLEMENTATION_SURFACE.length });
  hydratePersistedGeometry(persisted.geometry);
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  telemetry('clear-transient-selection', { reason: 'boot' });
  bindInputs();
  renderTabRegistry();
  void loadBlueprinttoolState().then(loadActiveLedgerState).then(renderCanvasSurface);
  renderCanvasSurface();
  renderThreadPanel();
}
