/**
 * WHAT: Merges locally optimistic thread notes into an incoming server ledger.
 * WHY: Server refreshes can be stale while note upload or transcription reconciliation is still in flight.
 */
import { state } from '../../state.js';
import { shouldApplyVoiceServerNote } from '../../voice/helper/voice-transcription-lifecycle.js';
import { normalizeLedgerNotes } from './normalize-ledger-notes.js';
import { normalizeDeletedNoteIds } from './normalize-deleted-note-ids.js';

function imageSizesRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.keys(value).length > 0 ? value as Record<string, unknown> : null;
}

type MergeLocalThreadNotesOptions = {
  localLedger?: Record<string, any> | null;
  threadId?: string;
};

function includesThread(threadId: string, selectedThreadId: string | undefined): boolean {
  return selectedThreadId === undefined || threadId === selectedThreadId;
}

export function mergeLocalThreadNotes(
  ledger: Record<string, any> | null,
  options: MergeLocalThreadNotesOptions = {}
): Record<string, any> | null {
  if (!ledger || typeof ledger !== 'object') return ledger;
  const localLedger = Object.prototype.hasOwnProperty.call(options, 'localLedger') ? options.localLedger : state.activeLedger;
  const localNotes = localLedger ? normalizeLedgerNotes(localLedger) : undefined;
  const localDeleted = localLedger ? normalizeDeletedNoteIds(localLedger) : {};
  if (!localNotes || typeof localNotes !== 'object') return ledger;
  const nextNotes = { ...normalizeLedgerNotes(ledger) } as Record<string, Array<Record<string, any>>>;
  const nextDeleted = { ...normalizeDeletedNoteIds(ledger) } as Record<string, string[]>;
  for (const [threadId, deletedIds] of Object.entries(localDeleted)) {
    if (!includesThread(threadId, options.threadId)) continue;
    const mergedDeleted = new Set([...(nextDeleted[threadId] ?? []), ...(Array.isArray(deletedIds) ? deletedIds : [])].map((id) => String(id)));
    if (mergedDeleted.size > 0) nextDeleted[threadId] = Array.from(mergedDeleted);
  }
  for (const [threadId, deletedIds] of Object.entries(nextDeleted)) {
    if (!includesThread(threadId, options.threadId)) continue;
    const deletedSet = new Set((Array.isArray(deletedIds) ? deletedIds : []).map((id) => String(id)));
    if (!deletedSet.size || !Array.isArray(nextNotes[threadId])) continue;
    nextNotes[threadId] = nextNotes[threadId].filter((note) => !deletedSet.has(String(note.id ?? '')));
  }
  for (const [threadId, notes] of Object.entries(localNotes as Record<string, Array<Record<string, any>>>)) {
    if (!includesThread(threadId, options.threadId)) continue;
    if (!Array.isArray(notes)) continue;
    const incomingIncludesThreadSlice = Object.prototype.hasOwnProperty.call(nextNotes, threadId);
    const deletedSet = new Set((nextDeleted[threadId] ?? []).map((id) => String(id)));
    const merged = Array.isArray(nextNotes[threadId]) ? [...nextNotes[threadId]] : [];
    for (const localNote of notes) {
      const noteId = String(localNote.id ?? '');
      if (!noteId) continue;
      if (deletedSet.has(noteId)) continue;
      const localImageSizes = imageSizesRecord(localNote.imageSizes);
      const existingIndex = merged.findIndex((note) => String(note.id ?? '') === noteId);
      if (localImageSizes && existingIndex >= 0) {
        const existingImageSizes = imageSizesRecord(merged[existingIndex].imageSizes) ?? {};
        merged[existingIndex] = {
          ...merged[existingIndex],
          imageSizes: { ...existingImageSizes, ...localImageSizes }
        };
      }
      // WHAT: Preserve every loaded thread note when the incoming canvas projection intentionally omits thread slices.
      // WHY: A ledger lifecycle refresh must not erase the independently loaded active conversation.
      if (incomingIncludesThreadSlice && !localNote?.optimistic) continue;
      const localVoiceUploadId = String(localNote.localVoiceUploadId ?? '').trim();
      if (
        incomingIncludesThreadSlice
        && existingIndex >= 0
        && localNote.optimistic === true
        && localVoiceUploadId
        && shouldApplyVoiceServerNote(localNote, merged[existingIndex])
      ) {
        // WHAT: Install a forward same-ID server voice lifecycle while retaining browser-owned cleanup state.
        // WHY: The generic optimistic overlay otherwise restores the stale uploading placeholder over its durable transcript.
        merged[existingIndex] = {
          ...merged[existingIndex],
          localVoiceUploadId,
          optimistic: false
        };
        continue;
      }
      if (existingIndex >= 0) merged[existingIndex] = { ...merged[existingIndex], ...localNote };
      else merged.push(localNote);
    }
    if (merged.length > 0 || Object.prototype.hasOwnProperty.call(nextNotes, threadId)) nextNotes[threadId] = merged;
  }
  ledger.notes = nextNotes;
  ledger.deletedNoteIds = nextDeleted;
  return ledger;
}
