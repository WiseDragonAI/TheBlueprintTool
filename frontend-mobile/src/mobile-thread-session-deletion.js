function primaryAction(modal) {
  return modal?.querySelector?.('[data-action]:not([data-action="cancel-delete"])') ?? null;
}

export function resetMobileThreadConfirmationModal(modal) {
  if (!modal) return;
  delete modal.dataset.confirmKind;
  delete modal.dataset.ledgerId;
  delete modal.dataset.cardId;
  delete modal.dataset.runId;
  delete modal.dataset.threadId;
  delete modal.dataset.noteId;
  const message = modal.querySelector?.('p');
  const confirm = primaryAction(modal);
  if (message) message.textContent = 'Delete this note?';
  if (confirm) {
    confirm.dataset.action = 'delete-note';
    confirm.textContent = 'Delete note';
    confirm.disabled = false;
  }
}

function focusIfAvailable(element) {
  if (element && element.isConnected !== false) element.focus?.();
}

export function createMobileThreadSessionDeletionHandler(dependencies) {
  let trigger = null;

  return async function handleMobileThreadSessionDeletion({ action, button }) {
    const modal = dependencies.modal();
    if (action === 'confirm-delete-thread-codex-session') {
      trigger = button;
      dependencies.confirm({
        ledgerId: dependencies.ledgerId(),
        cardId: button.dataset.codexCardId || dependencies.cardId(),
        runId: button.dataset.codexRunId || '',
        threadId: button.dataset.threadId || dependencies.threadId(),
      });
      return true;
    }
    if (action === 'delete-thread-codex-session') {
      const ok = await dependencies.remove({
        ledgerId: button.dataset.ledgerId || modal?.dataset.ledgerId || dependencies.ledgerId(),
        cardId: button.dataset.cardId || modal?.dataset.cardId || dependencies.cardId(),
        runId: button.dataset.runId || modal?.dataset.runId || '',
        threadId: button.dataset.threadId || modal?.dataset.threadId || dependencies.threadId(),
      });
      if (modal?.open) modal.close?.();
      resetMobileThreadConfirmationModal(modal);
      focusIfAvailable(ok ? dependencies.successFocus?.() : trigger);
      trigger = null;
      return true;
    }
    if (action === 'cancel-delete' && modal?.dataset.confirmKind === 'codex-session') {
      modal.close?.();
      resetMobileThreadConfirmationModal(modal);
      focusIfAvailable(trigger);
      trigger = null;
      return true;
    }
    return false;
  };
}
