/**
 * WHAT: Sends an active ledger mutation without replacing local runtime state.
 * WHY: Optimistic notes own their visible state while the backend reconciles in the background.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { ledgerEndpointForTab } from '../helper/ledger-endpoint-for-tab.js';
import type { ActiveLedgerMutation } from './commit-active-ledger-mutation.js';
import { acceptTaskClockForInstall, taskClockFromResponse, taskMutationReceiptMatches } from '../../refresh/helper/task-causal-clock.js';
import {
  acknowledgePendingTaskMutationReceipt,
  beginPendingTaskMutationReceipt,
  type PersistedTaskMutationReceipt,
} from '../../refresh/helper/pending-task-mutation-receipts.js';

export type SendActiveLedgerMutationOptions = {
  domain?: PersistedTaskMutationReceipt['domain'];
  entityId?: string;
  intent?: string;
};

function noteEntityId(mutation: ActiveLedgerMutation): string {
  const threadId = String(mutation.note?.threadId ?? '');
  const noteId = String(mutation.note?.id ?? '');
  return threadId && noteId ? `${threadId}/${noteId}` : '';
}

export function prepareActiveLedgerMutation(
  mutation: ActiveLedgerMutation,
  options: SendActiveLedgerMutationOptions = {},
): ActiveLedgerMutation {
  const prepared = mutation.mutationId ? mutation : { ...mutation, mutationId: crypto.randomUUID() };
  const taskMutation = state.activeTab === 'tasks';
  const entityId = options.entityId ?? noteEntityId(prepared);
  if (taskMutation && options.domain && entityId) {
    beginPendingTaskMutationReceipt({
      mutationId: prepared.mutationId!,
      entityId,
      projectId: String(state.projectId ?? ''),
      ledgerId: state.activeTab,
      domain: options.domain,
      mutation: prepared,
      intent: options.intent,
    });
  }
  return prepared;
}

export async function sendActiveLedgerMutation(
  mutation: ActiveLedgerMutation,
  options: SendActiveLedgerMutationOptions = {},
): Promise<boolean> {
  mutation = prepareActiveLedgerMutation(mutation, options);
  const endpoint = ledgerEndpointForTab(state.activeTab);
  if (!endpoint) return false;
  const taskMutation = state.activeTab === 'tasks';
  const entityId = options.entityId ?? noteEntityId(mutation);
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
  if (taskMutation && options.domain && entityId) {
    const payload = await response.json().catch(() => null);
    const taskClock = (
      payload?.taskClock && typeof payload.taskClock === 'object' && !Array.isArray(payload.taskClock)
        ? payload.taskClock
        : taskClockFromResponse(response)
    ) as Record<string, number> | null;
    if (!taskMutationReceiptMatches(payload, mutation.mutationId!) || !taskClock) {
      telemetry('send-ledger-edit-failed', {
        activeTab: state.activeTab,
        action: mutation.action,
        authority: 'optimistic-client',
        reason: 'task-mutation-receipt-missing',
      });
      return false;
    }
    acknowledgePendingTaskMutationReceipt(mutation.mutationId!, taskClock);
    if (!acceptTaskClockForInstall(taskClock, `optimistic-mutation-response:${mutation.action}`)) return false;
  }
  return true;
}
