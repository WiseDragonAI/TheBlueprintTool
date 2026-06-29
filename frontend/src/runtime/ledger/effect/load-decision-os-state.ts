import { state } from '../../state.js';
import { renderTabRegistry } from '../../navigation/effect/render-tab-registry.js';
import { routeTab } from '../../navigation/helper/route-tab.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function loadDecisionOsState(): Promise<void> {
  const response = await fetch('/decision-os/state').catch(() => undefined);
  if (!response?.ok) {
    telemetry('load-decision-os-state', { ok: false });
    return;
  }
  const blueprintState = await response.json().catch(() => undefined) as { tabs?: Array<{ id?: string; title?: string; ledgerFile?: string }> } | undefined;
  const tabs = blueprintState?.tabs?.filter((tab) => tab.id && tab.title) ?? [];
  if (tabs.length > 0) state.ledgerTabs = tabs;
  state.activeTab = routeTab(window.location.pathname);
  if (!state.ledgerTabs.some((tab: { id: string }) => tab.id === state.activeTab)) {
    state.activeTab = state.ledgerTabs[0]?.id ?? state.activeTab;
    history.replaceState?.({}, '', `/${state.activeTab}`);
  }
  telemetry('load-decision-os-state', { ok: true, tabs: state.ledgerTabs.map((tab: { id: string }) => tab.id) });
  renderTabRegistry();
}
