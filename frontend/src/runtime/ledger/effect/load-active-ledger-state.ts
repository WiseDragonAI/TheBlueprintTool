/**
 * WHAT: Loads the active route ledger from the backend.
 * WHY: Server ledgers are authoritative, while optimistic thread notes must survive stale refreshes.
 */
import { state } from '../../state.js';
import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';
import { mergeLocalCanvasStateIntoLedger } from '../helper/merge-local-canvas-state.js';
import { mergeLocalThreadNotes } from '../helper/merge-local-thread-notes.js';
import { refreshZoneAttributionCache } from '../helper/zone-attribution-cache.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function loadActiveLedgerState(): Promise<void> {
  const endpoint = ledgerEndpointForTab(state.activeTab);
  const ledgerStateId = state.canvasMode === 'ledgers' ? 'ledgers-canvas' : state.activeTab;
  const canMergeLocalCanvas = Boolean(state.activeLedger && state.activeLedgerId === ledgerStateId);
  const localLedger = canMergeLocalCanvas ? state.activeLedger : null;
  const localViewport = canMergeLocalCanvas ? { ...state.viewport } : null;
  if (!endpoint) {
    state.activeLedger = null;
    state.activeLedgerId = '';
    refreshZoneAttributionCache('missing-ledger-tab');
    telemetry('load-ledger-state', { activeTab: state.activeTab, ok: false, source: 'missing-ledger-tab' });
    return;
  }
  const response = await fetch(endpoint).catch(() => undefined);
  if (!response?.ok) {
    state.activeLedger = null;
    state.activeLedgerId = '';
    refreshZoneAttributionCache('load-failed');
    telemetry('load-ledger-state', { activeTab: state.activeTab, ok: false });
    return;
  }
  const ledger = await response.json().catch(() => null);
  state.activeLedger = mergeLocalThreadNotes(canMergeLocalCanvas ? mergeLocalCanvasStateIntoLedger(ledger, localLedger) : ledger);
  state.activeLedgerId = ledgerStateId;
  refreshZoneAttributionCache('load-active-ledger-state');
  if (localViewport) {
    Object.assign(state.viewport, localViewport);
    if (state.canvasMode === 'ledger') state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...localViewport } };
  } else if (state.canvasMode === 'ledgers') Object.assign(state.viewport, ledger?.viewport ?? state.viewport);
  else Object.assign(state.viewport, state.viewports?.[state.activeTab] ?? ledger?.viewport ?? state.viewport);
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  telemetry('load-ledger-state', { activeTab: state.activeTab, canvasMode: state.canvasMode, ok: Boolean(ledger), cards: ledger?.cards?.length ?? 0, relationships: ledger?.relationships?.length ?? 0 });
}
