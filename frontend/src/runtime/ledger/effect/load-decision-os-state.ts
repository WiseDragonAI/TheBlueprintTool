import { state } from '../../state.js';
import { renderTabRegistry } from '../../navigation/effect/render-tab-registry.js';
import { routeCanvasMode } from '../../navigation/helper/route-canvas-mode.js';
import { routeTab } from '../../navigation/helper/route-tab.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function loadDecisionOsState(): Promise<void> {
  const response = await fetch('/decision-os/state').catch(() => undefined);
  if (!response?.ok) {
    telemetry('load-decision-os-state', { ok: false });
    return;
  }
  const blueprintState = await response.json().catch(() => undefined) as { ledgers?: Array<{ id?: string; title?: string; ledgerFile?: string; cardId?: string }>; tabs?: Array<{ id?: string; title?: string; ledgerFile?: string; cardId?: string }> } | undefined;
  const ledgers = (blueprintState?.ledgers ?? blueprintState?.tabs ?? []).filter((ledger) => ledger.id && ledger.title);
  if (ledgers.length > 0) {
    state.ledgers = ledgers;
    state.ledgerTabs = ledgers;
  }
  state.canvasMode = routeCanvasMode(window.location.pathname);
  if (state.canvasMode === 'ledger') {
    state.activeTab = routeTab(window.location.pathname);
    state.activeLedgerId = state.activeTab;
  }
  if (state.canvasMode === 'ledger' && !state.ledgers.some((ledger: { id: string }) => ledger.id === state.activeTab)) {
    state.activeTab = state.ledgers[0]?.id ?? state.activeTab;
    state.activeLedgerId = state.activeTab;
    history.replaceState?.({}, '', `/${state.activeTab}`);
  }
  telemetry('load-decision-os-state', { ok: true, ledgers: state.ledgers.map((ledger: { id: string }) => ledger.id), canvasMode: state.canvasMode });
  renderTabRegistry();
}
