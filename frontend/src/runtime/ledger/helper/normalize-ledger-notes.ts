/**
 * WHAT: Normalizes runtime ledger notes into a thread-id keyed note map.
 * WHY: Legacy ledgers may load with notes as [], but optimistic note state must persist by thread id.
 */
export function normalizeLedgerNotes(ledger: { notes?: unknown }): Record<string, Array<Record<string, any>>> {
  if (!ledger.notes || Array.isArray(ledger.notes) || typeof ledger.notes !== 'object') {
    ledger.notes = {};
  }
  return ledger.notes as Record<string, Array<Record<string, any>>>;
}
