/**
 * WHAT: Merges locally optimistic thread notes into an incoming server ledger.
 * WHY: Server refreshes can be stale while note upload or transcription reconciliation is still in flight.
 */
import { state } from '../../state.js';
import { normalizeLedgerNotes } from './normalize-ledger-notes.js';
import { normalizeDeletedNoteIds } from './normalize-deleted-note-ids.js';

export function mergeLocalThreadNotes(ledger: Record<string, any> | null): Record<string, any> | null {
  if (!ledger || typeof ledger !== 'object') return ledger;
  const localNotes = state.activeLedger ? normalizeLedgerNotes(state.activeLedger) : undefined;
  const localDeleted = state.activeLedger ? normalizeDeletedNoteIds(state.activeLedger) : {};
  if (!localNotes || typeof localNotes !== 'object') return ledger;
  const nextNotes = { ...normalizeLedgerNotes(ledger) } as Record<string, Array<Record<string, any>>>;
  const nextDeleted = { ...normalizeDeletedNoteIds(ledger) } as Record<string, string[]>;
  for (const [threadId, deletedIds] of Object.entries(localDeleted)) {
    const mergedDeleted = new Set([...(nextDeleted[threadId] ?? []), ...(Array.isArray(deletedIds) ? deletedIds : [])].map((id) => String(id)));
    if (mergedDeleted.size > 0) nextDeleted[threadId] = Array.from(mergedDeleted);
  }
  for (const [threadId, deletedIds] of Object.entries(nextDeleted)) {
    const deletedSet = new Set((Array.isArray(deletedIds) ? deletedIds : []).map((id) => String(id)));
    if (!deletedSet.size || !Array.isArray(nextNotes[threadId])) continue;
    nextNotes[threadId] = nextNotes[threadId].filter((note) => !deletedSet.has(String(note.id ?? '')));
  }
  for (const [threadId, notes] of Object.entries(localNotes as Record<string, Array<Record<string, any>>>)) {
    if (!Array.isArray(notes)) continue;
    const deletedSet = new Set((nextDeleted[threadId] ?? []).map((id) => String(id)));
    const merged = Array.isArray(nextNotes[threadId]) ? [...nextNotes[threadId]] : [];
    for (const localNote of notes) {
      if (!localNote?.optimistic) continue;
      const noteId = String(localNote.id ?? '');
      if (!noteId) continue;
      if (deletedSet.has(noteId)) continue;
      const existingIndex = merged.findIndex((note) => String(note.id ?? '') === noteId);
      if (existingIndex >= 0) merged[existingIndex] = { ...merged[existingIndex], ...localNote };
      else merged.push(localNote);
    }
    if (merged.length > 0 || Object.prototype.hasOwnProperty.call(nextNotes, threadId)) nextNotes[threadId] = merged;
  }
  ledger.notes = nextNotes;
  ledger.deletedNoteIds = nextDeleted;
  return ledger;
}
