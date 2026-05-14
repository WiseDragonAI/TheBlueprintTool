import { state } from '../../state.js';
import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function loadActiveLedgerState(): Promise<void> {
  const endpoint = ledgerEndpointForTab(state.activeTab);
  if (!endpoint) {
    state.activeLedger = null;
    telemetry('load-ledger-state', { activeTab: state.activeTab, ok: false, source: 'missing-ledger-tab' });
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
  Object.assign(state.viewport, state.viewports?.[state.activeTab] ?? ledger?.viewport ?? state.viewport);
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  telemetry('load-ledger-state', { activeTab: state.activeTab, ok: Boolean(ledger), cards: ledger?.cards?.length ?? 0, relationships: ledger?.relationships?.length ?? 0 });
}
