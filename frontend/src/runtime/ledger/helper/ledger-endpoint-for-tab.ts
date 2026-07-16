import { state } from '../../state.js';
import { activeLedgers } from './active-ledgers.js';

export function ledgerEndpointForTab(tabId: string): string {
  if (state.canvasMode === 'projects') return '/decision-os/projects-canvas';
  if (state.canvasMode === 'ledgers') return '/decision-os/ledgers-canvas';
  return activeLedgers().some((ledger: { id: string }) => ledger.id === tabId) ? `/decision-os/${tabId}` : '';
}
