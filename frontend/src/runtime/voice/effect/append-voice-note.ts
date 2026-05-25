/**
 * WHAT: Persists a voice upload or transcript as an active thread note.
 * WHY: Voice input must appear in the conversation ledger even before transcription completes.
 */
import { sendActiveLedgerMutation } from '../../ledger/effect/send-active-ledger-mutation.js';
import { state } from '../../state.js';
import { appendOptimisticThreadNote } from '../../thread/effect/append-optimistic-thread-note.js';

export type AppendVoiceNoteResult = {
  ok: boolean;
  noteId: string;
  committed: Promise<boolean>;
};

export function appendVoiceNote(input: { body: string; voiceFileRef?: string; status?: string; error?: string }): AppendVoiceNoteResult {
  if (!state.threadId) return { ok: false, noteId: '', committed: Promise.resolve(false) };
  const noteId = appendOptimisticThreadNote({
    threadId: state.threadId,
    body: input.body,
    voiceFileRef: input.voiceFileRef,
    status: input.status,
    error: input.error,
    source: 'voice'
  });
  const committed = sendActiveLedgerMutation({
    action: 'append-note',
    note: {
      id: noteId,
      threadId: state.threadId,
      body: input.body,
      voiceFileRef: input.voiceFileRef,
      status: input.status,
      error: input.error,
      source: 'voice'
    }
  });
  return { ok: true, noteId, committed };
}
