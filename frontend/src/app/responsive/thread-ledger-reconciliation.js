/**
 * WHAT: Reconciles a refreshed ledger with the active responsive thread state.
 * WHY: The thread renderer must read the same server-confirmed ledger object as the application.
 */
import { mergeLocalThreadNotes } from '/src/runtime/ledger/helper/merge-local-thread-notes.js';

export function reconcileResponsiveThreadLedger(input) {
  const ledger = input.refreshedLedger ?? input.activeLedger;
  if (!ledger) return { ledger: null, card: input.currentCard ?? null };

  const slice = input.slice ?? {};
  ledger.threadFiles = { ...(ledger.threadFiles || {}), ...(slice.threadFiles || {}) };
  ledger.notes = { ...(ledger.notes || {}), ...(slice.notes || {}) };
  ledger.deletedNoteIds = { ...(ledger.deletedNoteIds || {}), ...(slice.deletedNoteIds || {}) };
  const threadId = String(input.threadId || '');
  const withLocalNotes = mergeLocalThreadNotes(ledger, {
    localLedger: input.activeLedger,
    ...(threadId ? { threadId } : {}),
  }) ?? ledger;

  const cardId = String(input.currentCard?.id ?? '');
  const refreshedCard = cardId
    ? withLocalNotes.cards?.find((entry) => String(entry.id ?? '') === cardId) ?? null
    : null;
  const card = refreshedCard
    ? { ...(input.currentCard || {}), ...refreshedCard }
    : input.currentCard ?? null;
  if (card && refreshedCard && Array.isArray(withLocalNotes.cards)) {
    withLocalNotes.cards = withLocalNotes.cards.map((entry) => String(entry.id ?? '') === cardId ? card : entry);
  }
  const optimisticRunId = String(input.optimisticRunId ?? '').trim();
  if (card && optimisticRunId) {
    card.codexThreadRunId = optimisticRunId;
  }

  return { ledger: withLocalNotes, card };
}
