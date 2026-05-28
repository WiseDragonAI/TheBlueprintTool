/**
 * WHAT: Routes card double-clicks to title or description edit modes.
 * WHY: Editing should depend on the clicked card region, not generic bold markdown inside the body.
 */
import { beginLedgerCardDescriptionEdit, beginLedgerCardTitleEdit } from '../../card/effect/begin-ledger-card-edit.js';

export function handleCardDoubleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (target.closest('[data-ledger-card-media]')) return;
  const card = target.closest('[data-card-id]') as HTMLElement | null;
  if (!card) return;

  event.preventDefault();
  event.stopPropagation();
  if (target.closest('.ledger-card-title')) {
    beginLedgerCardTitleEdit(card);
    return;
  }
  if (target.closest('.ledger-card-body')) {
    beginLedgerCardDescriptionEdit(card);
  }
}
