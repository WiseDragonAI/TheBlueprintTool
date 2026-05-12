export async function browserLoadTab(tabId) {
  document.querySelector('[data-tab="' + tabId + '"]').click();
  await browserWaitFrame();
  const cards = [...document.querySelectorAll('.ledger-node[data-card-id]')];
  const staticRelationships = [...document.querySelectorAll('.relationships:not(.ledger-relationships)')];
  const visibleStaticRelationshipPaths = [...document.querySelectorAll('.relationships:not(.ledger-relationships) [data-relationship-id]')].filter(function browserVisibleStaticRelationshipPath(path) {
    return path.getClientRects().length > 0;
  });
  return {
    tabId,
    route: location.pathname,
    activeTab: window.__coreState.activeTab,
    ledgerCardCount: cards.length,
    firstTitle: cards[0]?.querySelector('strong')?.textContent ?? '',
    staticSurfaceHidden: document.querySelector('[data-card-id="card-boot"]')?.hidden === true,
    staticRelationshipsHidden: staticRelationships.every(function browserStaticRelationshipHidden(overlay) {
      return overlay.hasAttribute('hidden') && getComputedStyle(overlay).display === 'none';
    }),
    staticRelationshipVisibleCount: visibleStaticRelationshipPaths.length,
    telemetryHit: window.__coreTelemetry.some(function browserLedgerTelemetryHit(entry) { return entry.name === 'render-ledger-surface' && entry.args.activeTab === tabId; }),
    relationshipEndpointChecks: browserEndpointChecks('.ledger-relationships [data-relationship-id]')
  };
}
