/**
 * WHAT: Patches an existing voice note row in the active conversation ledger.
 * WHY: Optimistic voice entries must move through upload, transcription, failure, and retry states without losing audio.
 */
import { state } from '../../state.js';

export async function updateVoiceNote(input: { noteId: string; body?: string; voiceFileRef?: string; status?: string; error?: string }): Promise<boolean> {
  if (!state.threadId || !input.noteId) return false;
  const { commitActiveLedgerMutation } = await import('../../ledger/effect/commit-active-ledger-mutation.js');
  const ok = await commitActiveLedgerMutation({
    action: 'update-note',
    note: {
      id: input.noteId,
      threadId: state.threadId,
      body: input.body,
      voiceFileRef: input.voiceFileRef,
      status: input.status,
      error: input.error,
      source: 'voice'
    }
  }, { render: false });
  if (ok) {
    const { renderThreadPanel } = await import('../../thread/effect/render-thread-panel.js');
    renderThreadPanel();
  }
  return ok;
}
