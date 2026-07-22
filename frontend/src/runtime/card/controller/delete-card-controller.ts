/**
 * WHAT: Deletes one card from the active ledger through the server mutation path.
 * WHY: Confirmed card deletion must persist instead of only removing the DOM node.
 */
import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { runOptimisticActiveLedgerMutation } from '../../ledger/effect/run-optimistic-active-ledger-mutation.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { refreshZoneAttributionCache } from '../../ledger/helper/zone-attribution-cache.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function deleteCardController(input: { cardId: string }): Promise<void> {
  const cardId = input.cardId;
  if (!cardId) return;
  telemetry('delete-card-controller', { cardId });
  if (state.activeLedger && state.canvasMode === 'ledger') {
    const previousSelection = structuredClone(state.selection);
    state.selection.cardIds = state.selection.cardIds.filter((id: string) => id !== cardId);
    modal.close?.();
    await runOptimisticActiveLedgerMutation({
      mutation: { action: 'delete-card', cardId },
      apply: (ledger) => {
        ledger.cards = (ledger.cards ?? []).filter((card: Record<string, unknown>) => String(card.id ?? '') !== cardId);
        ledger.relationships = (ledger.relationships ?? []).filter((relationship: Record<string, unknown>) => (
          String(relationship.from ?? '') !== cardId && String(relationship.to ?? '') !== cardId
        ));
        if (ledger.notes && typeof ledger.notes === 'object') delete ledger.notes[`thread-${cardId}`];
        if (ledger.threadFiles && typeof ledger.threadFiles === 'object') delete ledger.threadFiles[`thread-${cardId}`];
      },
      render: (outcome) => {
        if (outcome === 'rejected') state.selection = previousSelection;
        refreshZoneAttributionCache(`optimistic-delete-card:${outcome}`);
        renderCanvasSurface();
      },
    });
    return;
  }
  const committed = await commitActiveLedgerMutation({ action: 'delete-card', cardId }, { render: true });
  if (!committed) return;
  state.selection.cardIds = state.selection.cardIds.filter((id: string) => id !== cardId);
  modal.close?.();
}
