/**
 * WHAT: Appends a text note to the active thread ledger.
 * WHY: Text notes must appear immediately and then reconcile with the backend.
 */
import { prepareActiveLedgerMutation, sendActiveLedgerMutation } from '../../ledger/effect/send-active-ledger-mutation.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { state } from '../../state.js';
import { appendOptimisticThreadNote } from '../effect/append-optimistic-thread-note.js';
import { patchOptimisticThreadNote } from '../effect/patch-optimistic-thread-note.js';

export type CreateNoteResult = {
  noteId: string;
  committed: Promise<boolean>;
};

export function createNoteController(input: { threadId: string; body: string }): CreateNoteResult {
  telemetry('create-note-controller', { threadId: input.threadId });
  const noteId = `note-${Date.now()}-${crypto.randomUUID()}`;
  const options = {
    domain: 'message' as const,
    entityId: `${input.threadId}/${noteId}`,
  };
  let mutation;
  try {
    // WHAT: Commit the reload-surviving message intent before exposing the optimistic row.
    // WHY: A crash between paint and persistence must not make a visible message unrecoverable.
    mutation = prepareActiveLedgerMutation({
      action: 'append-note',
      note: { id: noteId, threadId: input.threadId, body: input.body }
    }, options);
  } catch (error) {
    telemetry('create-note-persistence-failed', {
      threadId: input.threadId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { noteId: '', committed: Promise.resolve(false) };
  }
  appendOptimisticThreadNote({ noteId, threadId: input.threadId, body: input.body, status: 'committing' });
  const optimistic = state.activeLedger?.notes?.[input.threadId]?.find((candidate: Record<string, unknown>) => String(candidate.id ?? '') === noteId);
  if (optimistic) optimistic.mutationReceiptId = mutation.mutationId;
  const committed = sendActiveLedgerMutation(mutation, options).then((ok) => {
    patchOptimisticThreadNote({
      threadId: input.threadId,
      noteId,
      status: ok ? 'synchronizing' : 'commit failed',
      error: ok ? '' : 'Backend did not confirm the note.',
      optimistic: true,
    });
    return ok;
  });
  return { noteId, committed };
}
