/**
 * WHAT: Commits the terminal draft as a thread note and clears the composer.
 * WHY: Notes should be entered from the terminal input without create/delete buttons.
 */
import { createNoteController } from '../controller/create-note-controller.js';
import { renderThreadPanel } from './render-thread-panel.js';
import { state } from '../../state.js';
import { renderVoiceStatus } from '../../voice/effect/render-voice-status.js';

export async function submitThreadDraft(): Promise<void> {
  const draft = document.querySelector('.thread-draft') as HTMLTextAreaElement | null;
  const body = draft?.value.trim() ?? '';
  if (!draft || !body) return;
  if (!state.threadId) state.threadId = 'conversation-ledger';
  const ok = await createNoteController({ threadId: state.threadId, body });
  if (!ok) {
    state.voice.transcriptionStatus = 'note commit failed';
    renderVoiceStatus();
    return;
  }
  draft.value = '';
  renderThreadPanel();
}
