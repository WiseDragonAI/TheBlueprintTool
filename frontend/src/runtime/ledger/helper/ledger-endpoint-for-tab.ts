import { state } from '../../state.js';

export function ledgerEndpointForTab(tabId: string): string {
  return (state.ledgerTabs ?? []).some((tab: { id: string }) => tab.id === tabId) ? `/blueprinttool/${tabId}` : '';
}
