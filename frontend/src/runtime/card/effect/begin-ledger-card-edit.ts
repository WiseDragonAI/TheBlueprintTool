/**
 * WHAT: Opens inline card title and description editors.
 * WHY: Card editing should preserve markdown source while routing persistence through ledger mutations.
 */
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { runOptimisticActiveLedgerMutation } from '../../ledger/effect/run-optimistic-active-ledger-mutation.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { openLedgerCardEditor } from '../../content-authoring/controller/ledger-card-editor.js';
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

  const card = activeLedgerCard(cardId);
  title.contentEditable = 'true';
  title.classList.add('editing');
  title.textContent = String(card?.title ?? title.textContent ?? '');
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
      if (state.canvasMode === 'ledger') {
        void runOptimisticActiveLedgerMutation({
          mutation: { action: 'patch-card', cardPatch: { id: cardId, title: nextTitle } },
          apply: (ledger) => {
            const current = (ledger.cards ?? []).find((entry: Record<string, unknown>) => String(entry.id ?? '') === cardId);
            if (current) current.title = nextTitle;
          },
          render: () => renderCanvasSurface({ renderThreadPanel: false }),
        });
      } else void commitActiveLedgerMutation({ action: 'patch-card', cardPatch: { id: cardId, title: nextTitle } }, { render: true });
    }
  }, { once: true });
  telemetry('open-card-title-edit', { cardId });
}

export function beginLedgerCardDescriptionEdit(cardElement: HTMLElement): void {
  const cardId = cardElement.dataset.cardId;
  if (!cardId) return;
  const card = activeLedgerCard(cardId);
  if (!card || !state.projectId || !state.activeLedgerId) return;
  const returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : cardElement;
  // WHAT: Terminate editor-open failures at the card interaction boundary.
  // WHY: A synchronous gesture entrypoint cannot leave its asynchronous modal request unobserved.
  void openLedgerCardEditor({
    projectId: state.projectId,
    ledgerId: state.activeLedgerId,
    cardId,
    card,
    returnFocusTo,
    onSaved: (saved) => {
      const current = activeLedgerCard(cardId);
      if (!current) return;
      Object.assign(current, saved);
      renderCanvasSurface({ renderThreadPanel: false });
    },
  }).catch((error: unknown) => {
    console.error('Card Markdown editor could not open.', error);
  });
  telemetry('open-card-description-edit', { cardId });
}
