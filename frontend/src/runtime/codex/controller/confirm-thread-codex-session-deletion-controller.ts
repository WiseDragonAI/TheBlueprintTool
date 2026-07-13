/**
 * WHAT: Opens the shared destructive confirmation modal for one thread Codex session.
 * WHY: Session deletion can stop a live process and permanently removes its context and log.
 */
import { modal } from '../../dom.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function confirmThreadCodexSessionDeletionController(input: { ledgerId: string; cardId: string; runId: string; threadId: string }): void {
  telemetry('confirm-thread-codex-session-deletion-controller', input);
  modal.dataset.confirmKind = 'codex-session';
  modal.dataset.ledgerId = input.ledgerId;
  modal.dataset.cardId = input.cardId;
  modal.dataset.runId = input.runId;
  modal.dataset.threadId = input.threadId;
  delete modal.dataset.imageSrc;
  delete modal.dataset.groupId;
  delete modal.dataset.noteId;
  const message = modal.querySelector('p');
  const confirm = modal.querySelector('[data-action]') as HTMLButtonElement | null;
  const cancel = modal.querySelector('[data-action="cancel-delete"]') as HTMLButtonElement | null;
  if (message) message.textContent = 'Delete this Codex session? An active run will be stopped and its context and log will be permanently removed.';
  if (confirm) {
    confirm.dataset.action = 'delete-thread-codex-session';
    confirm.textContent = 'Delete session';
    confirm.disabled = false;
  }
  if (cancel) cancel.textContent = 'Cancel';
  modal.showModal?.();
  confirm?.focus();
}
