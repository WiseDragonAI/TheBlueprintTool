/**
 * WHAT: Sends an active ledger mutation without replacing local runtime state.
 * WHY: Optimistic notes own their visible state while the backend reconciles in the background.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';
import type { ActiveLedgerMutation } from './commit-active-ledger-mutation.js';

export type ActiveLedgerMutationResult = {
  ok: boolean;
  status: number;
  errorCode: string;
  contentFile: string;
};

export async function sendActiveLedgerMutationResult(mutation: ActiveLedgerMutation): Promise<ActiveLedgerMutationResult> {
  const endpoint = ledgerEndpointForTab(state.activeTab);
  if (!endpoint) return { ok: false, status: 0, errorCode: 'missing_ledger_endpoint', contentFile: '' };
  telemetry('send-ledger-edit', { activeTab: state.activeTab, action: mutation.action, authority: 'optimistic-client' });
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mutation)
  }).catch(() => undefined);
  const payload = response && typeof response.json === 'function'
    ? await response.json().catch(() => null) as Record<string, unknown> | null
    : null;
  if (!response?.ok || payload?.ok === false) {
    telemetry('send-ledger-edit-failed', { activeTab: state.activeTab, action: mutation.action, authority: 'optimistic-client' });
    return {
      ok: false,
      status: response?.status ?? 0,
      errorCode: String(payload?.error ?? (response ? `http_${response.status}` : 'network_unavailable')),
      contentFile: String(payload?.contentFile ?? ''),
    };
  }
  return { ok: true, status: response.status, errorCode: '', contentFile: '' };
}

export async function sendActiveLedgerMutation(mutation: ActiveLedgerMutation): Promise<boolean> {
  return (await sendActiveLedgerMutationResult(mutation)).ok;
}
