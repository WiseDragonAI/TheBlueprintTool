import type { CardPersistedWorkStatus, CardVisibleWorkStatus } from '../../card/helper/resolve-card-work-status.js';

export function renderLedgerCardStatusButton(cardId: string, persistedStatus: CardPersistedWorkStatus, visibleStatus: CardVisibleWorkStatus): HTMLButtonElement {
  const nextStatus = persistedStatus === 'done' ? 'todo' : 'done';
  const button = document.createElement('button');
  button.className = 'ledger-card-status-toggle terminal-button terminal-button--compact';
  button.type = 'button';
  button.dataset.action = 'toggle-card-status';
  button.dataset.cardId = cardId;
  button.dataset.nextStatus = nextStatus;
  button.disabled = visibleStatus === 'processing';
  button.title = button.disabled ? 'Waiting for agent response' : `Mark card ${nextStatus}`;
  button.setAttribute('aria-label', button.title);
  button.textContent = nextStatus;
  return button;
}
