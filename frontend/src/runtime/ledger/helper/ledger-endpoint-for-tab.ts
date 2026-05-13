export function ledgerEndpointForTab(tabId: string): string {
  return tabId === 'specs' || tabId === 'data' ? `/blueprinttool/${tabId}` : '';
}
