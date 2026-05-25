/**
 * WHAT: Normalizes ledger notes into a thread-id keyed note map.
 * WHY: Legacy ledgers may store notes as [], and string keys on arrays are lost during JSON persistence.
 */
export function normalizeLedgerNotes(ledger: { notes?: unknown }): Record<string, Array<Record<string, unknown>>> {
  if (!ledger.notes || Array.isArray(ledger.notes) || typeof ledger.notes !== 'object') {
    ledger.notes = {};
  }
  return ledger.notes as Record<string, Array<Record<string, unknown>>>;
}
