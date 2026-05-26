/**
 * WHAT: Deletes one card from the active ledger through the server mutation path.
 * WHY: Confirmed card deletion must persist instead of only removing the DOM node.
 */
import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function deleteCardController(input: { cardId: string }): Promise<void> {
  const cardId = input.cardId;
  if (!cardId) return;
  telemetry('delete-card-controller', { cardId });
  const committed = await commitActiveLedgerMutation({ action: 'delete-card', cardId }, { render: true });
  if (!committed) return;
  state.selection.cardIds = state.selection.cardIds.filter((id: string) => id !== cardId);
  modal.close?.();
}
