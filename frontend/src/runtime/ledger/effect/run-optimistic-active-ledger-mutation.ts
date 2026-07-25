/**
 * WHAT: Applies one active-canvas ledger mutation immediately and persists it in scoped sequence order.
 * WHY: Canvas interactions need deterministic rollback and pending-intent replay over authoritative refreshes.
 */
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { projectReplicaRequestPath, replicaRequestInit } from '../../project/helper/project-request-scope.js';
import { createOptimisticLedgerTransactionCoordinator } from '../helper/optimistic-ledger-transaction.js';
import type { ActiveLedgerMutation } from './commit-active-ledger-mutation.js';
import { acceptTaskClockForInstall, taskClockFromResponse, taskMutationReceiptMatches } from '../../refresh/helper/task-causal-clock.js';

type Ledger = Record<string, any>;
type Scope = { projectId: string; replicaNodeId: string; ledgerId: string };

function scopeKey(scope: Scope): string {
  return JSON.stringify(scope);
}

function parseScope(value: string): Scope {
  const scope = JSON.parse(value) as Partial<Scope>;
  return {
    projectId: String(scope.projectId ?? ''),
    replicaNodeId: String(scope.replicaNodeId ?? ''),
    ledgerId: String(scope.ledgerId ?? ''),
  };
}

function activeScope(): Scope {
  return {
    projectId: String(state.projectId ?? ''),
    replicaNodeId: String(state.replicaNodeId ?? ''),
    ledgerId: String(state.activeTab ?? ''),
  };
}

async function requestConfirmedLedger(scopeValue: string, mutation: ActiveLedgerMutation) {
  const scope = parseScope(scopeValue);
  const mutationPath = projectReplicaRequestPath(`/decision-os/${encodeURIComponent(scope.ledgerId)}`, scope.projectId, scope.replicaNodeId);
  const response = await fetch(mutationPath, replicaRequestInit({
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mutation),
  }, scope.replicaNodeId)).catch(() => undefined);
  const payload = await response?.json().catch(() => null) as Ledger | null | undefined;
  if (!response?.ok || payload?.ok === false) return { ok: false as const, error: payload?.error ?? `http-${response?.status ?? 0}` };
  if (payload?.ok === true && payload.taskClock && typeof payload.taskClock === 'object' && !Array.isArray(payload.taskClock)) {
    // WHAT: Bind causal acknowledgement to the exact optimistic transaction identity.
    // WHY: A successful but mismatched response cannot settle or expose another mutation's task clock.
    if (!taskMutationReceiptMatches(payload, String(mutation.mutationId ?? ''))) {
      return { ok: false as const, error: 'task-mutation-receipt-mismatch' };
    }
    acceptTaskClockForInstall(payload.taskClock as Record<string, number>, 'optimistic-mutation-response');
  }
  if (payload && payload.ok !== true) return { ok: true as const, confirmed: payload };

  const snapshotPath = projectReplicaRequestPath(`/api/ledgers/${encodeURIComponent(scope.ledgerId)}/canvas`, scope.projectId, scope.replicaNodeId);
  const snapshot = await fetch(snapshotPath, replicaRequestInit({ cache: 'no-store' }, scope.replicaNodeId)).catch(() => undefined);
  const confirmed = await snapshot?.json().catch(() => null) as Ledger | null | undefined;
  if (!snapshot?.ok || !confirmed || typeof confirmed !== 'object' || Array.isArray(confirmed)) {
    telemetry('commit-ledger-confirmation-refresh-failed', {
      ledgerId: scope.ledgerId,
      projectId: scope.projectId,
      replicaNodeId: scope.replicaNodeId,
      status: snapshot?.status ?? 0,
    });
    return { ok: true as const };
  }
  // WHAT: Pass optimistic confirmation through the same Epoch 4 causal installation gate as ordinary refreshes.
  // WHY: The coordinator's direct write boundary must not let a delayed relay snapshot bypass receipt acknowledgement.
  if (!acceptTaskClockForInstall(taskClockFromResponse(snapshot), 'optimistic-mutation-confirmation')) {
    return { ok: true as const };
  }
  return { ok: true as const, confirmed };
}

const coordinator = createOptimisticLedgerTransactionCoordinator<Ledger, ActiveLedgerMutation>({
  read: () => state.activeLedger,
  write: (ledger) => { state.activeLedger = ledger; },
  persist: requestConfirmedLedger,
  isScopeActive: (value) => value === scopeKey(activeScope()),
});

export function activeLedgerOptimisticScope(): string {
  return scopeKey(activeScope());
}

export function overlayPendingActiveLedger(ledger: Ledger, ledgerStateId: string): Ledger {
  if (state.canvasMode !== 'ledger' || String(state.activeTab ?? '') !== ledgerStateId) return ledger;
  return coordinator.reconcile(activeLedgerOptimisticScope(), ledger);
}

export function runOptimisticActiveLedgerMutation(input: {
  mutation: ActiveLedgerMutation;
  apply: (ledger: Ledger) => void;
  render?: (outcome: 'optimistic' | 'confirmed' | 'rejected') => void;
  onRejected?: (error: unknown) => void;
}): Promise<boolean> {
  telemetry('commit-ledger-edit', { activeTab: state.activeTab, action: input.mutation.action, authority: 'optimistic-client' });
  const mutation = input.mutation.mutationId
    ? input.mutation
    : { ...input.mutation, mutationId: crypto.randomUUID() };
  return coordinator.run({
    scope: activeLedgerOptimisticScope(),
    mutation,
    apply: input.apply,
    render: input.render,
    onRejected: (error) => {
      telemetry('commit-ledger-edit-failed', { activeTab: state.activeTab, action: input.mutation.action, authority: 'optimistic-client' });
      input.onRejected?.(error);
    },
  });
}
