export async function browserLoadTab(tabId) {
  document.querySelector('[data-tab="' + tabId + '"]').click();
  await browserWaitFrame();
  const cards = [...document.querySelectorAll('.ledger-node[data-card-id]')];
  return {
    tabId,
    route: location.pathname,
    activeTab: window.__coreState.activeTab,
    ledgerCardCount: cards.length,
    firstTitle: cards[0]?.querySelector('strong')?.textContent ?? '',
    staticSurfaceHidden: document.querySelector('[data-card-id="card-boot"]')?.hidden === true,
    telemetryHit: window.__coreTelemetry.some(function browserLedgerTelemetryHit(entry) { return entry.name === 'render-ledger-surface' && entry.args.activeTab === tabId; }),
    relationshipEndpointChecks: browserEndpointChecks('.ledger-relationships [data-relationship-id]')
  };
}
