/**
 * WHAT: Loads the active route ledger from the backend.
 * WHY: Server ledgers are authoritative, while optimistic thread notes must survive stale refreshes.
 */
import { state } from '../../state.js';
import { cloneSelectionState } from '../../selection/helper/clone-selection-state.js';
import { pruneSelectionToActiveLedger } from '../../selection/helper/prune-selection-to-active-ledger.js';
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
  if (!endpoint) {
    // WHAT: Clear state that cannot belong to an unresolved route ledger.
    // WHY: Retaining either ledger data or selection would expose stale targets.
    state.activeLedger = null;
    state.activeLedgerId = '';
    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
    refreshZoneAttributionCache('missing-ledger-tab');
    telemetry('load-ledger-state', { activeTab: state.activeTab, ok: false, source: 'missing-ledger-tab' });
    return;
  }
  const response = await fetch(endpoint).catch(() => undefined);
  if (!response?.ok) {
    // WHAT: Clear state when the authoritative ledger cannot be loaded.
    // WHY: Selection cannot remain valid without its owning ledger.
    state.activeLedger = null;
    state.activeLedgerId = '';
    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
    refreshZoneAttributionCache('load-failed');
    telemetry('load-ledger-state', { activeTab: state.activeTab, ok: false });
    return;
  }
  const ledger = await response.json().catch(() => null);
  const canKeepCurrentViewport = Boolean(state.activeLedger && state.activeLedgerId === ledgerStateId);
  const localViewport = canKeepCurrentViewport ? { ...state.viewport } : null;
  state.activeLedger = mergeLocalThreadNotes(canMergeLocalCanvas ? mergeLocalCanvasStateIntoLedger(ledger, localLedger) : ledger);
  state.activeLedgerId = ledgerStateId;
  refreshZoneAttributionCache('load-active-ledger-state');
  if (localViewport) {
    Object.assign(state.viewport, localViewport);
    if (state.canvasMode === 'ledger') state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...localViewport } };
  } else if (state.canvasMode === 'ledgers') Object.assign(state.viewport, ledger?.viewport ?? state.viewport);
  else Object.assign(state.viewport, state.viewports?.[state.activeTab] ?? ledger?.viewport ?? state.viewport);
  if (canMergeLocalCanvas) {
    const prunedSelection = pruneSelectionToActiveLedger(state.selection);
    const pointerSnapshot = state.pointer?.selectionSnapshot;
    // WHAT: Prefer the active pointer operand for the same ledger; otherwise keep only refreshed ids.
    // WHY: A live gesture must remain stable while an idle selection must drop deleted records.
    state.selection = pointerSnapshot?.ledgerStateId === ledgerStateId
      ? cloneSelectionState(pointerSnapshot)
      : prunedSelection;
  } else {
    // WHAT: Reset selection across ledger identity changes.
    // WHY: Selection ids are scoped to their owning ledger.
    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  }
  telemetry('load-ledger-state', { activeTab: state.activeTab, canvasMode: state.canvasMode, ok: Boolean(ledger), cards: ledger?.cards?.length ?? 0, relationships: ledger?.relationships?.length ?? 0 });
}
