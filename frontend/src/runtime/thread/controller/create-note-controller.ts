/**
 * WHAT: Appends a text note to the active thread ledger.
 * WHY: Text notes must appear immediately and then reconcile with the backend.
 */
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { state } from '../../state.js';
import { appendOptimisticThreadNote } from '../effect/append-optimistic-thread-note.js';
import { commitPendingThreadMessage } from '../effect/commit-pending-thread-message.js';
import { persistPendingThreadMessage } from '../effect/persist-pending-thread-message.js';

export type CreateNoteResult = {
  noteId: string;
  committed: Promise<boolean>;
};

export function createNoteController(input: { threadId: string; body: string }): CreateNoteResult {
  telemetry('create-note-controller', { threadId: input.threadId });
  const noteId = `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let pending;
  try {
    // WHAT: Persist the intent before clearing the draft or painting the optimistic message.
    // WHY: Local durability is the admission boundary for a user-visible send action.
    pending = persistPendingThreadMessage({
      projectId: String(state.projectId ?? ''),
      replicaNodeId: String(state.replicaNodeId ?? ''),
      ledgerId: String(state.activeTab ?? ''),
      threadId: input.threadId,
      noteId,
      body: input.body,
    });
  } catch (error) {
    telemetry('create-note-persistence-failed', {
      threadId: input.threadId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { noteId: '', committed: Promise.resolve(false) };
  }
  appendOptimisticThreadNote({
    noteId,
    createdAt: pending.createdAt,
    threadId: input.threadId,
    body: input.body,
    status: 'committing',
    pendingMessageId: noteId,
  });
  const committed = commitPendingThreadMessage(pending);
  return { noteId, committed };
}
