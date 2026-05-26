/**
 * WHAT: Opens the shared confirmation modal for selected zone deletion.
 * WHY: Keyboard confirmation must know whether the modal is currently deleting zones or notes.
 */
import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function confirmZoneDeletionController(): void {
  telemetry('confirm-zone-deletion-controller', { zoneIds: state.selection.zoneIds });
  telemetry('confirm-zone-deletion', { zoneIds: state.selection.zoneIds });
  modal.dataset.confirmKind = 'zone';
  delete modal.dataset.cardId;
  delete modal.dataset.threadId;
  delete modal.dataset.noteId;
  const message = modal.querySelector('p');
  const confirm = modal.querySelector('[data-action]') as HTMLButtonElement | null;
  const cancel = modal.querySelector('[data-action="cancel-delete"]') as HTMLButtonElement | null;
  if (message) message.textContent = 'Delete selected zone?';
  if (confirm) {
    confirm.dataset.action = 'confirm-delete';
    confirm.textContent = 'Delete';
  }
  if (cancel) cancel.textContent = 'Cancel';
  modal.showModal?.();
}
