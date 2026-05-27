/**
 * WHAT: Opens the shared confirmation modal for group deletion.
 * WHY: Groups should use the same confirmed delete flow as cards, zones, and notes.
 */
import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function confirmGroupDeletionController(input: { groupId?: string } = {}): void {
  const groupIds = input.groupId ? [input.groupId] : [...state.selection.groupIds];
  telemetry('confirm-group-deletion-controller', { groupIds });
  modal.dataset.confirmKind = 'group';
  if (input.groupId) modal.dataset.groupId = input.groupId;
  else delete modal.dataset.groupId;
  delete modal.dataset.cardId;
  delete modal.dataset.threadId;
  delete modal.dataset.noteId;
  const message = modal.querySelector('p');
  const confirm = modal.querySelector('[data-action]') as HTMLButtonElement | null;
  const cancel = modal.querySelector('[data-action="cancel-delete"]') as HTMLButtonElement | null;
  if (message) message.textContent = groupIds.length > 1 ? 'Delete selected groups?' : 'Delete this group?';
  if (confirm) {
    confirm.dataset.action = 'delete-group';
    confirm.textContent = groupIds.length > 1 ? 'Delete groups' : 'Delete group';
  }
  if (cancel) cancel.textContent = 'Cancel';
  modal.showModal?.();
  confirm?.focus();
}
