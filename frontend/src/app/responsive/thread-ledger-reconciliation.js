/**
 * WHAT: Reconciles a refreshed ledger with the active responsive thread state.
 * WHY: The thread renderer must read the same server-confirmed ledger object as the application.
 */
export function reconcileResponsiveThreadLedger(input) {
  const ledger = input.refreshedLedger ?? input.activeLedger;
  if (!ledger) return { ledger: null, card: input.currentCard ?? null };

  const slice = input.slice ?? {};
  ledger.threadFiles = { ...(ledger.threadFiles || {}), ...(slice.threadFiles || {}) };
  ledger.notes = { ...(ledger.notes || {}), ...(slice.notes || {}) };
  ledger.deletedNoteIds = { ...(ledger.deletedNoteIds || {}), ...(slice.deletedNoteIds || {}) };

  const cardId = String(input.currentCard?.id ?? '');
  const card = cardId
    ? ledger.cards?.find((entry) => String(entry.id ?? '') === cardId) ?? input.currentCard
    : input.currentCard ?? null;
  const optimisticRunId = String(input.optimisticRunId ?? '').trim();
  if (card && optimisticRunId) {
    card.codexActiveRunId = optimisticRunId;
    card.codexThreadRunId = optimisticRunId;
  }

  return { ledger, card };
}
