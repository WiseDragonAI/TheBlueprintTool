import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';

type ZoneMutation = {
  action: 'create-zone' | 'delete-zones';
  annotation?: Record<string, unknown>;
  zoneIds?: string[];
};

export async function commitActiveLedgerZoneMutation(mutation: ZoneMutation): Promise<boolean> {
  const endpoint = ledgerEndpointForTab(state.activeTab);
  if (!endpoint) return false;
  telemetry('commit-ledger-edit', { activeTab: state.activeTab, action: mutation.action, authority: 'server' });
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mutation)
  }).catch(() => undefined);
  if (!response?.ok) {
    telemetry('commit-ledger-edit-failed', { activeTab: state.activeTab, action: mutation.action, authority: 'server' });
    return false;
  }
  const ledger = await response.json().catch(() => null);
  if (!ledger || typeof ledger !== 'object') return false;
  state.activeLedger = ledger;
  telemetry('load-ledger-state', { activeTab: state.activeTab, source: 'server-ledger-mutation', action: mutation.action });
  return true;
}
