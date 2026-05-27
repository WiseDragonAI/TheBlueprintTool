/**
 * WHAT: Normalizes deleted thread note tombstones into a thread-id keyed map.
 * WHY: Optimistic and late-arriving note writes must not resurrect notes the operator deleted.
 */
export function normalizeDeletedNoteIds(ledger: { deletedNoteIds?: unknown }): Record<string, string[]> {
  if (!ledger.deletedNoteIds || Array.isArray(ledger.deletedNoteIds) || typeof ledger.deletedNoteIds !== 'object') {
    ledger.deletedNoteIds = {};
  }
  return ledger.deletedNoteIds as Record<string, string[]>;
}

export function deletedNoteIdSet(ledger: { deletedNoteIds?: unknown }, threadId: string): Set<string> {
  const ids = normalizeDeletedNoteIds(ledger)[threadId] ?? [];
  return new Set(Array.isArray(ids) ? ids.map((id) => String(id)) : []);
}
