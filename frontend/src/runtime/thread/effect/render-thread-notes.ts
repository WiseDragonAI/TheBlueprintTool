/**
 * WHAT: Renders the active thread notes from the current ledger into the inspector.
 * WHY: Voice and text notes must appear as conversation ledger entries, not only draft text.
 */
import { state } from '../../state.js';
import { renderLedgerCardMarkdown } from '../../ledger/component/render-ledger-card-markdown.js';

export function renderThreadNotes(): void {
  const existing = document.querySelector('.thread-note-list') as HTMLElement | null;
  const feed = document.querySelector('.thread-feed') as HTMLElement | null;
  if (!feed && !existing) return;
  const list = existing ?? document.createElement('ol');
  list.className = 'thread-note-list';
  if (!existing) feed?.append(list);
  const notes = state.threadId ? (state.activeLedger?.notes?.[state.threadId] ?? []) : [];
  list.replaceChildren();
  for (const note of notes) {
    const status = String(note.status ?? '');
    const role = String(note.role ?? 'operator').toLowerCase();
    const agentOwned = role === 'agent' || role === 'assistant';
    const noteId = String(note.id ?? '');
    const normalizedStatus = status.toLowerCase();
    const busy = /committing|uploading|transcribing|retrying/.test(normalizedStatus);
    const retryable = Boolean(note.voiceFileRef) && /failed|not configured|unavailable/.test(normalizedStatus);
    const item = document.createElement('li');
    item.className = ['thread-note', note.voiceFileRef ? 'voice-note' : '', note.optimistic ? 'is-optimistic' : '', busy ? 'is-busy' : '', retryable ? 'is-retryable' : '', agentOwned ? 'is-agent' : 'is-operator'].filter(Boolean).join(' ');
    const body = renderLedgerCardMarkdown(String(note.message ?? note.body ?? ''));
    body.classList.add('thread-note-message');
    const meta = document.createElement('span');
    meta.className = 'thread-note-meta';
    meta.textContent = status;
    const deleteButton = document.createElement('button');
    deleteButton.className = 'thread-note-delete terminal-button terminal-button--compact';
    deleteButton.type = 'button';
    deleteButton.dataset.action = 'confirm-delete-note';
    deleteButton.dataset.threadId = state.threadId;
    deleteButton.dataset.noteId = noteId;
    deleteButton.title = 'Delete note';
    deleteButton.setAttribute('aria-label', 'Delete note');
    deleteButton.textContent = 'Delete';
    item.append(body);
    if (status) item.append(meta);
    if (noteId) item.append(deleteButton);
    if (busy) {
      const spinner = document.createElement('span');
      spinner.className = 'thread-note-spinner';
      spinner.textContent = 'processing';
      item.append(spinner);
    }
    if (retryable) {
      const retry = document.createElement('button');
      retry.className = 'thread-note-retry terminal-button terminal-button--compact';
      retry.type = 'button';
      retry.dataset.action = 'voice-retry';
      retry.dataset.noteId = String(note.id ?? '');
      retry.dataset.voiceFileRef = String(note.voiceFileRef ?? '');
      retry.textContent = 'Retry';
      item.append(retry);
    }
    list.append(item);
  }
}
