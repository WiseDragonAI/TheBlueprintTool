/**
 * WHAT: Commits the terminal draft as a thread note and clears the composer.
 * WHY: Notes should be entered from the terminal input without create/delete buttons.
 */
import { createNoteController } from '../controller/create-note-controller.js';
import { renderThreadPanel } from './render-thread-panel.js';
import { state } from '../../state.js';

export async function submitThreadDraft(): Promise<void> {
  const draft = document.querySelector('.thread-draft') as HTMLTextAreaElement | null;
  const body = draft?.value.trim() ?? '';
  if (!draft || !body) return;
  if (!state.threadId) state.threadId = 'conversation-ledger';
  await createNoteController({ threadId: state.threadId, body });
  draft.value = '';
  renderThreadPanel();
}
