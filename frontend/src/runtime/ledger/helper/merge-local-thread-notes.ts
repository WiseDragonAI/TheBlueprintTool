/**
 * WHAT: Merges locally optimistic thread notes into an incoming server ledger.
 * WHY: Server refreshes can be stale while note upload or transcription reconciliation is still in flight.
 */
import { state } from '../../state.js';

export function mergeLocalThreadNotes(ledger: Record<string, any> | null): Record<string, any> | null {
  if (!ledger || typeof ledger !== 'object') return ledger;
  const localNotes = state.activeLedger?.notes;
  if (!localNotes || typeof localNotes !== 'object') return ledger;
  const nextNotes = { ...(ledger.notes ?? {}) } as Record<string, Array<Record<string, any>>>;
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
    nextNotes[threadId] = merged;
  }
  ledger.notes = nextNotes;
  return ledger;
}
