/**
 * WHAT: Renders the active thread notes from the current ledger into the inspector.
 * WHY: Voice and text notes must appear as conversation ledger entries, not only draft text.
 */
import { state } from '../../state.js';

export function renderThreadNotes(): void {
  const existing = document.querySelector('.thread-note-list') as HTMLElement | null;
  const draft = document.querySelector('.thread-draft') as HTMLTextAreaElement | null;
  if (!draft) return;
  const list = existing ?? document.createElement('ol');
  list.className = 'thread-note-list';
  if (!existing) draft.before(list);
  const notes = state.threadId ? (state.activeLedger?.notes?.[state.threadId] ?? []) : [];
  list.replaceChildren();
  for (const note of notes) {
    const item = document.createElement('li');
    item.className = note.voiceFileRef ? 'thread-note voice-note' : 'thread-note';
    const body = document.createElement('p');
    body.textContent = String(note.message ?? note.body ?? '');
    const meta = document.createElement('span');
    meta.textContent = [note.role ?? 'operator', note.status, note.timestamp].filter(Boolean).join(' · ');
    item.append(body, meta);
    list.append(item);
  }
}
