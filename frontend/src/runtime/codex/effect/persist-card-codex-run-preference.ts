/**
 * WHAT: Persists and reconciles one card's complete Codex run preference pair.
 * WHY: Widget and thread controls must never become independent preference authorities.
 */
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { runOptimisticActiveLedgerMutation } from '../../ledger/effect/run-optimistic-active-ledger-mutation.js';
import { state } from '../../state.js';
import {
  activeCardCodexRunPreference,
  type CardCodexRunPreference,
} from '../helper/card-codex-run-preference.js';
import { isCodexEffort, isCodexModel } from '../helper/codex-run-options.js';

function setSelectValue(select: HTMLSelectElement | null, value: string, label: string): void {
  if (!select) return;
  select.value = value;
  select.title = `${label}: ${value}`;
}

export function synchronizeMountedCardCodexRunPreference(cardId: string, preference: CardCodexRunPreference): void {
  for (const widget of document.querySelectorAll<HTMLElement>('.codex-run-widget')) {
    if (widget.dataset.codexCardId !== cardId) continue;
    setSelectValue(widget.querySelector<HTMLSelectElement>('[data-codex-run-model]'), preference.model, 'Model');
    setSelectValue(widget.querySelector<HTMLSelectElement>('[data-codex-run-effort]'), preference.effort, 'Effort');
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('.thread-codex-button')) {
    if (button.dataset.codexCardId !== cardId) continue;
    button.dataset.codexModel = preference.model;
    button.dataset.codexEffort = preference.effort;
    const actions = button.parentElement;
    setSelectValue(actions?.querySelector<HTMLSelectElement>('[data-codex-preference="model"]') ?? null, preference.model, 'Model');
    setSelectValue(actions?.querySelector<HTMLSelectElement>('[data-codex-preference="effort"]') ?? null, preference.effort, 'Effort');
  }
}

export async function persistCardCodexRunPreference(input: { cardId: string; model: string; effort: string }): Promise<boolean> {
  if (!input.cardId || !isCodexModel(input.model) || !isCodexEffort(input.effort)) {
    if (input.cardId) synchronizeMountedCardCodexRunPreference(input.cardId, activeCardCodexRunPreference(input.cardId));
    return false;
  }

  const mutation = {
    action: 'patch-card' as const,
    cardPatch: {
      id: input.cardId,
      codexRunModel: input.model,
      codexRunEffort: input.effort,
    },
  };
  const optimisticPreference = { model: input.model, effort: input.effort } as CardCodexRunPreference;
  const committed = state.activeLedger && state.canvasMode === 'ledger'
    ? await runOptimisticActiveLedgerMutation({
      mutation,
      apply: (ledger) => {
        const card = (ledger.cards ?? []).find((entry: Record<string, unknown>) => String(entry.id ?? '') === input.cardId);
        if (!card) return;
        card.codexRunModel = input.model;
        card.codexRunEffort = input.effort;
      },
      render: (outcome) => synchronizeMountedCardCodexRunPreference(
        input.cardId,
        outcome === 'optimistic' ? optimisticPreference : activeCardCodexRunPreference(input.cardId),
      ),
    })
    : await commitActiveLedgerMutation(mutation);
  synchronizeMountedCardCodexRunPreference(input.cardId, activeCardCodexRunPreference(input.cardId));
  return committed;
}
