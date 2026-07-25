/**
 * WHAT: Decodes and admits Epoch 4 task projection clocks at every frontend installation boundary.
 * WHY: Aggregate response order cannot replace causal acknowledgement of locally persisted task intent.
 */
import { state, type LedgerReconciliationState } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export const taskClockHeader = 'x-decision-os-task-clock';

export function taskClockFromResponse(response: { headers?: { get?(name: string): string | null } } | undefined): Record<string, number> | null {
  const raw = response?.headers?.get?.(taskClockHeader);
  if (!raw) return null;
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(raw.length / 4) * 4, '=');
    const parsed = JSON.parse(atob(normalized)) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed);
    if (entries.some(([replicaId, counter]) => !replicaId || !Number.isSafeInteger(Number(counter)) || Number(counter) < 0)) return null;
    return Object.fromEntries(entries.map(([replicaId, counter]) => [replicaId, Number(counter)]));
  } catch {
    return null;
  }
}

export function taskMutationReceiptMatches(payload: unknown, mutationId: string): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !mutationId) return false;
  const receipt = (payload as Record<string, unknown>).receipt;
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false;
  return String((receipt as Record<string, unknown>).mutationId ?? '') === mutationId;
}

function clockDominates(incoming: Record<string, number>, installed: Record<string, number>): boolean {
  return Object.entries(installed).every(([replicaId, counter]) => Number(incoming[replicaId] ?? 0) >= counter);
}

export function acceptTaskClockForInstall(taskClock: Record<string, number> | null, source: string): boolean {
  const reconciliation = state.ledgerReconciliation as LedgerReconciliationState;
  if (!taskClock) {
    if (Object.keys(reconciliation.lastAppliedTaskClock ?? {}).length === 0) return true;
    telemetry('active-ledger-reconciliation-rejected', {
      source,
      reason: 'task-causal-clock-missing',
      lastAppliedTaskClock: reconciliation.lastAppliedTaskClock ?? {},
    });
    return false;
  }
  if (!clockDominates(taskClock, reconciliation.lastAppliedTaskClock ?? {})) {
    telemetry('active-ledger-reconciliation-rejected', {
      source,
      reason: 'task-causal-clock',
      taskClock,
      lastAppliedTaskClock: reconciliation.lastAppliedTaskClock ?? {},
    });
    return false;
  }
  reconciliation.lastAppliedTaskClock = { ...taskClock };
  return true;
}
