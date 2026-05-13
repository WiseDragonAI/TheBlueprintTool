import { state } from '../../state.js';
import { hydratePersistedGeometry } from '../../persistence/effect/hydrate-persisted-geometry.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import { readPersistedState } from '../../persistence/helper/read-persisted-state.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { renderTabRegistry } from '../../navigation/effect/render-tab-registry.js';
import { routeTab } from '../../navigation/helper/route-tab.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function refreshRuntimeState(): Promise<void> {
  telemetry('subscribe-server-refresh', { specId: '50000006', source: 'refresh-button' });
  await fetch('/blueprinttool/data').catch(() => undefined);
  const persisted = readPersistedState();
  state.activeTab = routeTab(window.location.pathname);
  state.viewports = persisted.viewports && typeof persisted.viewports === 'object' ? persisted.viewports : state.viewports;
  Object.assign(state.viewport, state.viewports?.[state.activeTab] ?? persisted.viewport ?? { x: 0, y: 0, scale: 1 });
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  hydratePersistedGeometry(persisted.geometry);
  await loadActiveLedgerState();
  telemetry('load-ledger-state', { specId: '50000006', restored: Boolean(persisted.geometry || persisted.viewport) });
  telemetry('merge-refresh-state', { specId: '50000006', source: 'refresh-button' });
  renderTabRegistry();
  renderCanvasSurface();
}
