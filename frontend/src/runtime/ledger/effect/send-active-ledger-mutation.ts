/**
 * WHAT: Sends an active ledger mutation without replacing local runtime state.
 * WHY: Optimistic notes own their visible state while the backend reconciles in the background.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';
import type { ActiveLedgerMutation } from './commit-active-ledger-mutation.js';

export async function sendActiveLedgerMutation(mutation: ActiveLedgerMutation): Promise<boolean> {
  const endpoint = ledgerEndpointForTab(state.activeTab);
  if (!endpoint) return false;
  telemetry('send-ledger-edit', { activeTab: state.activeTab, action: mutation.action, authority: 'optimistic-client' });
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mutation)
  }).catch(() => undefined);
  if (!response?.ok) {
    telemetry('send-ledger-edit-failed', { activeTab: state.activeTab, action: mutation.action, authority: 'optimistic-client' });
    return false;
  }
  return true;
}
