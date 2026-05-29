/**
 * WHAT: Commits the terminal draft as a thread note and clears the composer.
 * WHY: Notes should be entered from the terminal input without create/delete buttons.
 */
import { createNoteController } from '../controller/create-note-controller.js';
import { state } from '../../state.js';
import { renderVoiceStatus } from '../../voice/effect/render-voice-status.js';
import { clearThreadDraft, saveThreadDraft } from './persist-thread-draft.js';

export async function submitThreadDraft(): Promise<void> {
  const draft = document.querySelector('.thread-draft') as HTMLTextAreaElement | null;
  const body = draft?.value.trim() ?? '';
  if (!draft || !body) return;
  if (!state.threadId) state.threadId = 'conversation-ledger';
  saveThreadDraft(state.threadId);
  const note = createNoteController({ threadId: state.threadId, body });
  const ok = await note.committed;
  if (ok) {
    draft.value = '';
    clearThreadDraft(state.threadId);
  } else {
    state.voice.transcriptionStatus = 'note commit failed';
    renderVoiceStatus();
  }
}
