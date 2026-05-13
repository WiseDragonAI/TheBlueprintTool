import { state } from '../../state.js';
import { renderTabRegistry } from '../../navigation/effect/render-tab-registry.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function loadBlueprinttoolState(): Promise<void> {
  const response = await fetch('/blueprinttool/state').catch(() => undefined);
  if (!response?.ok) {
    telemetry('load-blueprinttool-state', { ok: false });
    return;
  }
  const blueprintState = await response.json().catch(() => undefined) as { tabs?: Array<{ id?: string; title?: string; ledgerFile?: string }> } | undefined;
  const tabs = blueprintState?.tabs?.filter((tab) => tab.id && tab.title) ?? [];
  if (tabs.length > 0) state.ledgerTabs = tabs;
  telemetry('load-blueprinttool-state', { ok: true, tabs: state.ledgerTabs.map((tab: { id: string }) => tab.id) });
  renderTabRegistry();
}
