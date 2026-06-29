import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderTabRegistry(): void {
  const activeLedgerTitle = state.ledgerTabs.find((tab: { id: string }) => tab.id === state.activeTab)?.title;
  document.title = typeof activeLedgerTitle === 'string' && activeLedgerTitle.trim() ? activeLedgerTitle : 'decision-os';

  const registry = document.querySelector('.tabs') as HTMLElement | null;
  if (registry) {
    const tabs = state.ledgerTabs.filter((tab: { id: string }, index: number, list: Array<{ id: string }>) => (
      list.findIndex((candidate) => candidate.id === tab.id) === index
    ));
    registry.replaceChildren();
    const createButton = document.createElement('button');
    createButton.className = 'tab tab-create';
    createButton.type = 'button';
    createButton.dataset.action = 'create-ledger';
    createButton.title = 'Create ledger';
    createButton.setAttribute('aria-label', 'Create ledger');
    createButton.textContent = '+';
    registry.appendChild(createButton);
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
  telemetry('render-tab-registry', { activeTab: state.activeTab, tabs: state.ledgerTabs.map((tab: { id: string }) => tab.id), source: 'decision-os-state' });
}
