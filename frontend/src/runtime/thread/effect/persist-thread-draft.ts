import { state } from '../../state.js';

const storageKey = 'corev2.thread.drafts';

function readDrafts(): Record<string, string> {
  try {
    if (typeof localStorage === 'undefined') return {};
    return JSON.parse(localStorage.getItem(storageKey) ?? '{}');
  } catch {
    return {};
  }
}

function writeDrafts(drafts: Record<string, string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(storageKey, JSON.stringify(drafts));
  } catch {
    // Draft persistence must never break thread rendering.
  }
}

export function saveThreadDraft(threadId = String(state.threadId ?? '')): void {
  if (!threadId) return;
  if (typeof document === 'undefined') return;
  const draft = document.querySelector('.thread-draft') as HTMLTextAreaElement | null;
  if (!draft) return;
  const drafts = readDrafts();
  if (draft.value) drafts[threadId] = draft.value;
  else delete drafts[threadId];
  writeDrafts(drafts);
}

export function restoreThreadDraft(threadId = String(state.threadId ?? '')): void {
  if (typeof document === 'undefined') return;
  const draft = document.querySelector('.thread-draft') as HTMLTextAreaElement | null;
  if (!draft) return;
  draft.value = threadId ? readDrafts()[threadId] ?? '' : '';
}

export function clearThreadDraft(threadId = String(state.threadId ?? '')): void {
  if (!threadId) return;
  const drafts = readDrafts();
  delete drafts[threadId];
  writeDrafts(drafts);
}
