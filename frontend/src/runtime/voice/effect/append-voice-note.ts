/**
 * WHAT: Persists a voice upload or transcript as an active thread note.
 * WHY: Voice input must appear in the conversation ledger even before transcription completes.
 */
import { state } from '../../state.js';

export async function appendVoiceNote(input: { body: string; voiceFileRef?: string; status?: string }): Promise<boolean> {
  if (!state.threadId) return false;
  const { commitActiveLedgerMutation } = await import('../../ledger/effect/commit-active-ledger-mutation.js');
  const ok = await commitActiveLedgerMutation({
    action: 'append-note',
    note: {
      threadId: state.threadId,
      body: input.body,
      voiceFileRef: input.voiceFileRef,
      status: input.status,
      source: 'voice'
    }
  }, { render: false });
  if (ok) {
    const { renderThreadPanel } = await import('../../thread/effect/render-thread-panel.js');
    renderThreadPanel();
  }
  return ok;
}
