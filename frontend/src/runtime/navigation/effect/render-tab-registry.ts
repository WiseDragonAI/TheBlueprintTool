import { state } from '../../state.js';
import { activeLedgers } from '../../ledger/helper/active-ledgers.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderTabRegistry(): void {
  const ledgers = activeLedgers().filter((ledger: { id: string }, index: number, list: Array<{ id: string }>) => (
    list.findIndex((candidate) => candidate.id === ledger.id) === index
  ));
  const activeLedgerTitle = ledgers.find((ledger: { id: string }) => ledger.id === state.activeTab)?.title;
  const projectName = String(state.projectName || 'Project').trim() || 'Project';
  const ledgerTitle = state.canvasMode === 'ledgers'
    ? 'Ledgers'
    : typeof activeLedgerTitle === 'string' && activeLedgerTitle.trim()
      ? activeLedgerTitle
      : state.activeTab;
  const identityTitle = `${projectName} | ${ledgerTitle}`;
  document.title = identityTitle;

  const titleAction = document.querySelector('.topbar-title-action') as HTMLElement | null;
  if (titleAction) titleAction.textContent = ledgerTitle;
  const kicker = document.querySelector('.topbar .kicker') as HTMLElement | null;
  if (kicker) kicker.textContent = projectName;

  const registry = document.querySelector('.tabs') as HTMLElement | null;
  if (registry) {
    registry.replaceChildren();
  }
  document.querySelectorAll('[data-tab]').forEach((tab) => tab.classList.toggle('active', state.canvasMode === 'ledger' && (tab as HTMLElement).dataset.tab === state.activeTab));
  telemetry('render-tab-registry', { activeTab: state.activeTab, canvasMode: state.canvasMode, projectName, ledgers: ledgers.map((ledger: { id: string }) => ledger.id), source: 'decision-os-state' });
}
