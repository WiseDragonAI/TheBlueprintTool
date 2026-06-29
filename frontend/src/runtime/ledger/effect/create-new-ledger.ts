import { state } from '../../state.js';
import { loadDecisionOsState } from './load-decision-os-state.js';
import { loadActiveLedgerState } from './load-active-ledger-state.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { renderTabRegistry } from '../../navigation/effect/render-tab-registry.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

type CreatedLedgerResponse = {
  ok?: boolean;
  tab?: { id?: string; title?: string; ledgerFile?: string };
  state?: { ledgers?: Array<{ id?: string; title?: string; ledgerFile?: string; cardId?: string }>; tabs?: Array<{ id?: string; title?: string; ledgerFile?: string; cardId?: string }> };
  error?: string;
};

export async function createNewLedger(): Promise<void> {
  const title = window.prompt('Ledger name', 'New Ledger')?.trim();
  if (!title) return;

  telemetry('create-ledger', { title });
  const response = await fetch('/decision-os/ledgers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title })
  }).catch(() => undefined);
  const payload = await response?.json().catch(() => undefined) as CreatedLedgerResponse | undefined;
  if (!response?.ok || payload?.ok === false || !payload?.tab?.id) {
    window.alert(payload?.error || 'Could not create ledger.');
    telemetry('create-ledger-failed', { title, status: response?.status ?? 0 });
    return;
  }

  state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...state.viewport } };
  persistState();
  const ledgers = payload.state?.ledgers ?? payload.state?.tabs;
  if (ledgers?.length) {
    state.ledgers = ledgers;
    state.ledgerTabs = ledgers;
  }
  state.activeTab = payload.tab.id;
  state.activeLedgerId = state.activeTab;
  state.canvasMode = 'ledger';
  history.pushState({}, '', `/${state.activeTab}`);
  await loadDecisionOsState();
  await loadActiveLedgerState();
  renderTabRegistry();
  renderCanvasSurface();
}
