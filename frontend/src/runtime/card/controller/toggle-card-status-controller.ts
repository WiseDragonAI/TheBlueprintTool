/**
 * WHAT: Persists a todo/done status change for one ledger card.
 * WHY: Card workflow state must use the same authoritative ledger mutation path as card edits.
 */
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function toggleCardStatusController(input: { cardId: string; status: 'todo' | 'done' }): Promise<void> {
  if (!input.cardId) return;
  telemetry('toggle-card-status-controller', { cardId: input.cardId, status: input.status });
  await commitActiveLedgerMutation({ action: 'patch-card', cardPatch: { id: input.cardId, status: input.status } }, { render: true });
}
