/**
 * WHAT: Persists a todo/done status change for one ledger card.
 * WHY: Card workflow state must use the same authoritative ledger mutation path as card edits.
 */
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { runOptimisticActiveLedgerMutation } from '../../ledger/effect/run-optimistic-active-ledger-mutation.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function toggleCardStatusController(input: { cardId: string; status: 'todo' | 'done' }): Promise<void> {
  if (!input.cardId) return;
  telemetry('toggle-card-status-controller', { cardId: input.cardId, status: input.status });
  await runOptimisticActiveLedgerMutation({
    mutation: { action: 'transition-card-lifecycle', cardId: input.cardId, lifecycleStatus: input.status },
    apply: (ledger) => {
      const card = (ledger.cards ?? []).find((entry: Record<string, unknown>) => String(entry.id ?? '') === input.cardId);
      if (card) card.status = input.status;
    },
    render: () => renderCanvasSurface(),
  });
}
