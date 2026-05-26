/**
 * WHAT: Renders the hover-revealed delete control for one ledger card.
 * WHY: Card deletion should enter the same confirmed modal flow as thread notes.
 */
export function renderLedgerCardDeleteButton(cardId: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'ledger-card-delete terminal-button terminal-button--compact';
  button.type = 'button';
  button.dataset.action = 'confirm-delete-card';
  button.dataset.cardId = cardId;
  button.title = 'Delete card';
  button.setAttribute('aria-label', 'Delete card');
  button.textContent = 'X';
  return button;
}
