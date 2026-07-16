/**
 * WHAT: Loads the active route ledger through the response-time reconciliation coordinator.
 * WHY: Server ledgers can resolve out of order while the operator keeps editing the canvas.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import {
  beginActiveLedgerRequest,
  ledgerRevisionFromResponse,
  reconcileActiveLedgerState,
  recordActiveLedgerLoadFailure
} from './reconcile-active-ledger-state.js';
import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';

type LoadActiveLedgerStateOptions = {
  activeTab?: string;
  canvasMode?: 'ledger' | 'ledgers' | 'projects';
  endpoint?: string;
  ledgerStateId?: string;
};

export async function loadActiveLedgerState(options?: LoadActiveLedgerStateOptions | void): Promise<boolean> {
  const loadOptions = (options ?? {}) as LoadActiveLedgerStateOptions;
  const canvasMode = loadOptions.canvasMode ?? state.canvasMode;
  const activeTab = loadOptions.activeTab ?? state.activeTab;
  const ledgerStateId = loadOptions.ledgerStateId ?? (canvasMode === 'projects' ? 'projects-canvas' : canvasMode === 'ledgers' ? 'ledgers-canvas' : activeTab);
  const endpoint = loadOptions.endpoint ?? (canvasMode === 'projects' ? '/decision-os/projects-canvas' : canvasMode === 'ledgers' ? '/decision-os/ledgers-canvas' : `/api/ledgers/${encodeURIComponent(activeTab)}/canvas`);
  const request = beginActiveLedgerRequest(ledgerStateId);
  if (!endpoint) {
    recordActiveLedgerLoadFailure({ request, source: 'load-active-ledger-state', reason: 'missing-ledger-tab' });
    return false;
  }

  const response = await fetch(endpoint).catch(() => undefined);
  if (!response?.ok) {
    recordActiveLedgerLoadFailure({ request, source: 'load-active-ledger-state', reason: `http-${response?.status ?? 0}` });
    return false;
  }
  const ledger = await response.json().catch(() => null);
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
    recordActiveLedgerLoadFailure({ request, source: 'load-active-ledger-state', reason: 'invalid-ledger' });
    return false;
  }

  const sameLedgerAtResponse = Boolean(state.activeLedger && state.activeLedgerId === ledgerStateId);
  const localViewport = sameLedgerAtResponse ? { ...state.viewport } : null;
  const applied = reconcileActiveLedgerState({
    ledger,
    request,
    serverRevision: ledgerRevisionFromResponse(response),
    source: 'load-active-ledger-state'
  });
  if (!applied) return false;

  if (localViewport) {
    Object.assign(state.viewport, localViewport);
    if (canvasMode === 'ledger') state.viewports = { ...(state.viewports ?? {}), [activeTab]: { ...localViewport } };
  } else if (canvasMode === 'ledgers' || canvasMode === 'projects') {
    Object.assign(state.viewport, (ledger as Record<string, any>).viewport ?? state.viewport);
  } else {
    Object.assign(state.viewport, state.viewports?.[activeTab] ?? (ledger as Record<string, any>).viewport ?? state.viewport);
  }
  telemetry('load-ledger-state', {
    activeTab,
    canvasMode,
    ok: true,
    cards: Array.isArray((ledger as Record<string, any>).cards) ? (ledger as Record<string, any>).cards.length : 0,
    relationships: Array.isArray((ledger as Record<string, any>).relationships) ? (ledger as Record<string, any>).relationships.length : 0
  });
  return true;
}
