import { state } from '../state.js';
import { ledgerEndpointForTab } from './ledger-endpoint-for-tab.js';
import { telemetry } from './telemetry.js';

export async function loadActiveLedgerState(): Promise<void> {
  const endpoint = ledgerEndpointForTab(state.activeTab);
  if (!endpoint) {
    state.activeLedger = null;
    Object.assign(state.viewport, state.surfaceViewport ?? { x: 0, y: 0, scale: 1 });
    telemetry('load-ledger-state', { activeTab: state.activeTab, source: 'static-surface' });
    return;
  }
  const response = await fetch(endpoint).catch(() => undefined);
  if (!response?.ok) {
    state.activeLedger = null;
    telemetry('load-ledger-state', { activeTab: state.activeTab, ok: false });
    return;
  }
  const ledger = await response.json().catch(() => null);
  state.activeLedger = ledger;
  if (ledger?.viewport) Object.assign(state.viewport, ledger.viewport);
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  telemetry('load-ledger-state', { activeTab: state.activeTab, ok: Boolean(ledger), cards: ledger?.cards?.length ?? 0, relationships: ledger?.relationships?.length ?? 0 });
}
