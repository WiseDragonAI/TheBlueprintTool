/**
 * WHAT: Appends a text note to the active thread ledger.
 * WHY: Text notes must appear immediately and then reconcile with the backend.
 */
import { sendActiveLedgerMutation } from '../../ledger/effect/send-active-ledger-mutation.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { appendOptimisticThreadNote } from '../effect/append-optimistic-thread-note.js';
import { patchOptimisticThreadNote } from '../effect/patch-optimistic-thread-note.js';

export type CreateNoteResult = {
  noteId: string;
  committed: Promise<boolean>;
};

export function createNoteController(input: { threadId: string; body: string }): CreateNoteResult {
  telemetry('create-note-controller', { threadId: input.threadId });
  const noteId = appendOptimisticThreadNote({ threadId: input.threadId, body: input.body, status: 'committing' });
  const committed = sendActiveLedgerMutation({
    action: 'append-note',
    note: { id: noteId, threadId: input.threadId, body: input.body }
  }).then((ok) => {
    patchOptimisticThreadNote({ threadId: input.threadId, noteId, status: ok ? '' : 'commit failed', error: ok ? '' : 'Backend did not confirm the note.', optimistic: !ok });
    return ok;
  });
  return { noteId, committed };
}
