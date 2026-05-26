/**
 * WHAT: Merges locally optimistic thread notes into an incoming server ledger.
 * WHY: Server refreshes can be stale while note upload or transcription reconciliation is still in flight.
 */
import { state } from '../../state.js';
import { normalizeLedgerNotes } from './normalize-ledger-notes.js';

export function mergeLocalThreadNotes(ledger: Record<string, any> | null): Record<string, any> | null {
  if (!ledger || typeof ledger !== 'object') return ledger;
  const localNotes = state.activeLedger ? normalizeLedgerNotes(state.activeLedger) : undefined;
  if (!localNotes || typeof localNotes !== 'object') return ledger;
  const nextNotes = { ...normalizeLedgerNotes(ledger) } as Record<string, Array<Record<string, any>>>;
  for (const [threadId, notes] of Object.entries(localNotes as Record<string, Array<Record<string, any>>>)) {
    if (!Array.isArray(notes)) continue;
    const merged = Array.isArray(nextNotes[threadId]) ? [...nextNotes[threadId]] : [];
    for (const localNote of notes) {
      if (!localNote?.optimistic) continue;
      const noteId = String(localNote.id ?? '');
      if (!noteId) continue;
      const existingIndex = merged.findIndex((note) => String(note.id ?? '') === noteId);
      if (existingIndex >= 0) merged[existingIndex] = { ...merged[existingIndex], ...localNote };
      else merged.push(localNote);
    }
    if (merged.length > 0 || Object.prototype.hasOwnProperty.call(nextNotes, threadId)) nextNotes[threadId] = merged;
  }
  ledger.notes = nextNotes;
  return ledger;
}
