import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { ledgerCardBody } from '../../ledger/helper/ledger-card-body.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

function activeLedgerCard(cardId: string): Record<string, unknown> | null {
  const cards = Array.isArray(state.activeLedger?.cards) ? state.activeLedger.cards as Array<Record<string, unknown>> : [];
  return cards.find((card) => String(card.id ?? '') === cardId) ?? null;
}

export function beginLedgerCardTitleEdit(cardElement: HTMLElement): void {
  const cardId = cardElement.dataset.cardId;
  const title = cardElement.querySelector('.ledger-card-title, strong') as HTMLElement | null;
  if (!cardId || !title) return;

  title.contentEditable = 'true';
  title.classList.add('editing');
  title.focus();
  document.getSelection()?.selectAllChildren(title);
  title.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key !== 'Enter') return;
    event.preventDefault();
    title.blur();
  }, { once: true });
  title.addEventListener('blur', () => {
    const nextTitle = title.textContent?.trim() || 'Untitled';
    title.contentEditable = 'false';
    title.classList.remove('editing');
    if (state.activeLedger) {
      void commitActiveLedgerMutation({ action: 'patch-card', cardPatch: { id: cardId, title: nextTitle } }, { render: true });
    }
  }, { once: true });
  telemetry('open-card-title-edit', { cardId });
}

export function beginLedgerCardDescriptionEdit(cardElement: HTMLElement): void {
  const cardId = cardElement.dataset.cardId;
  const body = cardElement.querySelector('.ledger-card-body') as HTMLElement | null;
  if (!cardId || !body) return;
  const card = activeLedgerCard(cardId);
  const textarea = document.createElement('textarea');
  textarea.className = 'ledger-card-description-editor';
  textarea.value = card ? ledgerCardBody(card) : body.textContent?.trim() ?? '';
  textarea.rows = 7;
  body.replaceChildren(textarea);
  textarea.focus();
  textarea.select();
  textarea.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Escape') {
      event.preventDefault();
      textarea.blur();
    }
    if ((event as KeyboardEvent).key === 'Enter' && ((event as KeyboardEvent).ctrlKey || (event as KeyboardEvent).metaKey)) {
      event.preventDefault();
      textarea.blur();
    }
  });
  textarea.addEventListener('blur', () => {
    if (state.activeLedger) {
      void commitActiveLedgerMutation({ action: 'patch-card', cardPatch: { id: cardId, description: textarea.value.trimEnd() } }, { render: true });
    }
  }, { once: true });
  telemetry('open-card-description-edit', { cardId });
}
