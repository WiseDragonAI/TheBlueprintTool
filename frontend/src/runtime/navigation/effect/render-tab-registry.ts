import { state } from '../../state.js';
import { activeLedgers } from '../../ledger/helper/active-ledgers.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderTabRegistry(): void {
  const ledgers = activeLedgers().filter((ledger: { id: string }, index: number, list: Array<{ id: string }>) => (
    list.findIndex((candidate) => candidate.id === ledger.id) === index
  ));
  const activeLedgerTitle = ledgers.find((ledger: { id: string }) => ledger.id === state.activeTab)?.title;
  document.title = state.canvasMode === 'ledgers' ? 'Ledgers' : typeof activeLedgerTitle === 'string' && activeLedgerTitle.trim() ? activeLedgerTitle : 'decision-os';

  const registry = document.querySelector('.tabs') as HTMLElement | null;
  if (registry) {
    registry.replaceChildren();
    const overviewButton = document.createElement('button');
    overviewButton.className = 'tab tab-ledgers';
    overviewButton.type = 'button';
    overviewButton.dataset.action = 'open-ledgers-canvas';
    overviewButton.textContent = 'Ledgers';
    overviewButton.classList.toggle('active', state.canvasMode === 'ledgers');
    registry.appendChild(overviewButton);
    const current = document.createElement('span');
    current.className = 'tab tab-current';
    current.textContent = state.canvasMode === 'ledgers' ? `${ledgers.length} ledgers` : activeLedgerTitle ?? state.activeTab;
    registry.appendChild(current);
    const createButton = document.createElement('button');
    createButton.className = 'tab tab-create';
    createButton.type = 'button';
    createButton.dataset.action = 'create-ledger';
    createButton.title = 'Create ledger';
    createButton.setAttribute('aria-label', 'Create ledger');
    createButton.textContent = '+';
    registry.appendChild(createButton);
  }
  document.querySelectorAll('[data-tab]').forEach((tab) => tab.classList.toggle('active', state.canvasMode === 'ledger' && (tab as HTMLElement).dataset.tab === state.activeTab));
  telemetry('render-tab-registry', { activeTab: state.activeTab, canvasMode: state.canvasMode, ledgers: ledgers.map((ledger: { id: string }) => ledger.id), source: 'decision-os-state' });
}
