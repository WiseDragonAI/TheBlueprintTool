/**
 * WHAT: Opens the shared confirmation modal for a specific card.
 * WHY: Card deletion must carry the card id through the same confirm/cancel flow as notes.
 */
import { modal } from '../../dom.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function confirmCardDeletionController(input: { cardId: string }): void {
  telemetry('confirm-card-deletion-controller', input);
  modal.dataset.confirmKind = 'card';
  modal.dataset.cardId = input.cardId;
  delete modal.dataset.threadId;
  delete modal.dataset.noteId;
  const message = modal.querySelector('p');
  const confirm = modal.querySelector('[data-action]') as HTMLButtonElement | null;
  const cancel = modal.querySelector('[data-action="cancel-delete"]') as HTMLButtonElement | null;
  if (message) message.textContent = 'Delete this card?';
  if (confirm) {
    confirm.dataset.action = 'delete-card';
    confirm.textContent = 'Delete card';
  }
  if (cancel) cancel.textContent = 'Cancel';
  modal.showModal?.();
  confirm?.focus();
}
