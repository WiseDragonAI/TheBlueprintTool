/**
 * WHAT: Opens the shared confirmation modal for a specific thread note.
 * WHY: Note deletion must carry the exact thread and note ids before mutating the ledger.
 */
import { modal } from '../../dom.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function confirmNoteDeletionController(input: { threadId: string; noteId: string }): void {
  telemetry('confirm-note-deletion-controller', input);
  modal.dataset.confirmKind = 'note';
  delete modal.dataset.cardId;
  delete modal.dataset.groupId;
  modal.dataset.threadId = input.threadId;
  modal.dataset.noteId = input.noteId;
  const message = modal.querySelector('p');
  const confirm = modal.querySelector('[data-action]') as HTMLButtonElement | null;
  const cancel = modal.querySelector('[data-action="cancel-delete"]') as HTMLButtonElement | null;
  if (message) message.textContent = 'Delete this note?';
  if (confirm) {
    confirm.dataset.action = 'delete-note';
    confirm.textContent = 'Delete note';
  }
  if (cancel) cancel.textContent = 'Cancel';
  modal.showModal?.();
  confirm?.focus();
}
