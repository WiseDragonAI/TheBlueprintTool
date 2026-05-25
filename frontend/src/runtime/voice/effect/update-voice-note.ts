/**
 * WHAT: Patches an existing voice note row in the active conversation ledger.
 * WHY: Optimistic voice entries must move through upload, transcription, failure, and retry states without losing audio.
 */
import { sendActiveLedgerMutation } from '../../ledger/effect/send-active-ledger-mutation.js';
import { state } from '../../state.js';
import { patchOptimisticThreadNote } from '../../thread/effect/patch-optimistic-thread-note.js';

export async function updateVoiceNote(input: { noteId: string; body?: string; voiceFileRef?: string; status?: string; error?: string }): Promise<boolean> {
  if (!state.threadId || !input.noteId) return false;
  const threadId = state.threadId;
  patchOptimisticThreadNote({
    threadId,
    noteId: input.noteId,
    body: input.body,
    voiceFileRef: input.voiceFileRef,
    status: input.status,
    error: input.error
  });
  return sendActiveLedgerMutation({
    action: 'update-note',
    note: {
      id: input.noteId,
      threadId,
      body: input.body,
      voiceFileRef: input.voiceFileRef,
      status: input.status,
      error: input.error,
      source: 'voice'
    }
  });
}
