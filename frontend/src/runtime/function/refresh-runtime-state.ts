import { state } from '../state.js';
import { hydratePersistedGeometry } from './hydrate-persisted-geometry.js';
import { readPersistedState } from './read-persisted-state.js';
import { renderCanvasSurface } from './render-canvas-surface.js';
import { renderTabRegistry } from './render-tab-registry.js';
import { routeTab } from './route-tab.js';
import { telemetry } from './telemetry.js';

export async function refreshRuntimeState(): Promise<void> {
  telemetry('subscribe-server-refresh', { specId: '50000006', source: 'refresh-button' });
  await fetch('/blueprinttool/data').catch(() => undefined);
  const persisted = readPersistedState();
  Object.assign(state.viewport, persisted.viewport ?? { x: 0, y: 0, scale: 1 });
  state.activeTab = routeTab(window.location.pathname);
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  hydratePersistedGeometry(persisted.geometry);
  telemetry('load-ledger-state', { specId: '50000006', restored: Boolean(persisted.geometry || persisted.viewport) });
  telemetry('merge-refresh-state', { specId: '50000006', source: 'refresh-button' });
  renderTabRegistry();
  renderCanvasSurface();
}
