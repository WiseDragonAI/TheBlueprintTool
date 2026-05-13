import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderTabRegistry(): void {
  const registry = document.querySelector('.tabs') as HTMLElement | null;
  if (registry) {
    const tabs = state.ledgerTabs.filter((tab: { id: string }, index: number, list: Array<{ id: string }>) => (
      list.findIndex((candidate) => candidate.id === tab.id) === index
    ));
    registry.replaceChildren();
    for (const tab of tabs) {
      const button = document.createElement('button');
      button.className = 'tab';
      button.type = 'button';
      button.dataset.tab = tab.id;
      button.textContent = tab.title;
      registry.appendChild(button);
    }
  }
  document.querySelectorAll('[data-tab]').forEach((tab) => tab.classList.toggle('active', (tab as HTMLElement).dataset.tab === state.activeTab));
  telemetry('render-tab-registry', { activeTab: state.activeTab, tabs: state.ledgerTabs.map((tab: { id: string }) => tab.id), source: 'blueprinttool-state' });
}
