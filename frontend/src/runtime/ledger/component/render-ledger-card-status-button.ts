import type { CardPersistedWorkStatus, CardVisibleWorkStatus } from '../../card/helper/resolve-card-work-status.js';

export function renderLedgerCardStatusButton(cardId: string, persistedStatus: CardPersistedWorkStatus, visibleStatus: CardVisibleWorkStatus): HTMLButtonElement {
  const nextStatus = persistedStatus === 'todo' ? 'done' : 'todo';
  const button = document.createElement('button');
  button.className = 'ledger-card-status-toggle terminal-button terminal-button--compact';
  button.type = 'button';
  button.dataset.action = 'toggle-card-status';
  button.dataset.cardId = cardId;
  button.dataset.cardCurrentStatus = visibleStatus;
  button.dataset.cardPersistedStatus = persistedStatus;
  button.dataset.nextStatus = nextStatus;
  button.disabled = visibleStatus === 'processing';
  button.title = button.disabled ? 'Current status: processing. Waiting for agent response' : `Current status: ${visibleStatus}. Mark card ${nextStatus}`;
  button.setAttribute('aria-label', button.title);
  button.textContent = nextStatus;
  return button;
}
