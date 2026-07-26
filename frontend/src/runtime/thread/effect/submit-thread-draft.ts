/**
 * WHAT: Commits the terminal draft as a thread note and clears the composer.
 * WHY: Notes should be entered from the terminal input without create/delete buttons.
 */
import { createNoteController } from '../controller/create-note-controller.js';
import { state } from '../../state.js';
import { renderVoiceStatus } from '../../voice/effect/render-voice-status.js';
import { clearThreadDraft } from './persist-thread-draft.js';

export async function submitThreadDraft(): Promise<void> {
  const draft = document.querySelector('.thread-draft') as HTMLTextAreaElement | null;
  const body = draft?.value.trim() ?? '';
  if (!draft || !body) return;
  if (!state.threadId) state.threadId = 'conversation-ledger';
  const threadId = state.threadId;
  const note = createNoteController({ threadId, body });
  // WHAT: Clear the composer only after the message intent is durable.
  // WHY: A local-storage failure must leave the operator's original draft available.
  if (!note.noteId) {
    state.voice.transcriptionStatus = 'message could not be saved locally; draft retained';
    renderVoiceStatus();
    return;
  }
  draft.value = '';
  clearThreadDraft(threadId);
  void note.committed.then((ok) => {
    if (ok) return;
    state.voice.transcriptionStatus = 'note commit failed; note retained for retry';
    renderVoiceStatus();
  });
}
