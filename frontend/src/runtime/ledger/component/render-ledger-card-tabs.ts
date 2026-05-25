export function renderLedgerCardTabs(cardId: string, activeTab: string): HTMLElement {
  const tabs = document.createElement('div');
  tabs.className = 'ledger-card-tabs';
  tabs.dataset.spec = 'a6f4c2e1 e4c1b8f5 b0f6a1c3 f8d2c4a7';
  tabs.role = 'tablist';
  for (const [tabId, label] of [['description', 'Description'], ['fields', 'Fields']]) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'ledger-card-tab';
    tab.dataset.action = 'switch-card-tab';
    tab.dataset.cardTab = tabId;
    tab.dataset.cardId = cardId;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(activeTab === tabId));
    tab.classList.toggle('is-active', activeTab === tabId);
    tab.textContent = label;
    tabs.appendChild(tab);
  }
  return tabs;
}
