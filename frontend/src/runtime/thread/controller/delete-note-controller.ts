/**
 * WHAT: Deletes a specific note from a thread through the active ledger mutation path.
 * WHY: Conversation note deletion must target one note id instead of dropping the latest entry.
 */
import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { normalizeDeletedNoteIds } from '../../ledger/helper/normalize-deleted-note-ids.js';
import { normalizeLedgerNotes } from '../../ledger/helper/normalize-ledger-notes.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderThreadPanel } from '../effect/render-thread-panel.js';

export async function deleteNoteController(input: string | { threadId: string; noteId?: string }): Promise<void> {
  const threadId = typeof input === 'string' ? input : input.threadId;
  const noteId = typeof input === 'string' ? '' : input.noteId ?? '';
  telemetry('delete-note-controller', { threadId, noteId });
  const removed = removeLocalThreadNote(threadId, noteId);
  if (removed.changed) renderThreadPanel();
  const committed = await commitActiveLedgerMutation({ action: 'delete-note', note: { threadId, id: noteId } }, { render: true });
  if (!committed) {
    restoreLocalThreadNote(threadId, removed);
    renderThreadPanel();
    return;
  }
  modal.close?.();
}

type RemovedNote = {
  changed: boolean;
  note?: Record<string, any>;
  index: number;
  tombstonedId: string;
};

function removeLocalThreadNote(threadId: string, noteId: string): RemovedNote {
  if (!state.activeLedger || !threadId) return { changed: false, index: -1, tombstonedId: '' };
  const notesByThread = normalizeLedgerNotes(state.activeLedger);
  const notes = notesByThread[threadId] ?? [];
  const index = noteId ? notes.findIndex((note) => String(note.id ?? '') === noteId) : notes.length - 1;
  if (index < 0) return { changed: false, index: -1, tombstonedId: noteId };
  const [note] = notes.splice(index, 1);
  notesByThread[threadId] = notes;
  const tombstonedId = String(noteId || note?.id || '');
  if (tombstonedId) {
    const deleted = normalizeDeletedNoteIds(state.activeLedger);
    deleted[threadId] = Array.from(new Set([...(deleted[threadId] ?? []), tombstonedId]));
  }
  return { changed: true, note, index, tombstonedId };
}

function restoreLocalThreadNote(threadId: string, removed: RemovedNote): void {
  if (!state.activeLedger || !removed.changed || !removed.note) return;
  const notesByThread = normalizeLedgerNotes(state.activeLedger);
  const notes = notesByThread[threadId] ?? [];
  notes.splice(Math.max(0, removed.index), 0, removed.note);
  notesByThread[threadId] = notes;
  if (removed.tombstonedId) {
    const deleted = normalizeDeletedNoteIds(state.activeLedger);
    deleted[threadId] = (deleted[threadId] ?? []).filter((id) => String(id) !== removed.tombstonedId);
  }
}
