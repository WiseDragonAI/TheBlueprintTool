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
  draft.value = '';
  clearThreadDraft(threadId);
  const note = createNoteController({ threadId, body });
  void note.committed.then((ok) => {
    if (ok) return;
    state.voice.transcriptionStatus = 'note commit failed; note retained for retry';
    renderVoiceStatus();
  });
}
