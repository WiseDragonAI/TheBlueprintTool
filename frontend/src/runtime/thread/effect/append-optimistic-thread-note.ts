/**
 * WHAT: Adds a local thread note before the backend answers.
 * WHY: Text and voice notes must be visible immediately and survive failed reconciliation.
 */
import { state } from '../../state.js';
import { normalizeLedgerNotes } from '../../ledger/helper/normalize-ledger-notes.js';
import { ensureCoordinatorOwnedActiveLedger } from '../../ledger/effect/reconcile-active-ledger-state.js';
import { currentLedgerStateId } from '../../ledger/helper/current-ledger-state-id.js';

export type OptimisticThreadNoteInput = {
  noteId?: string;
  createdAt?: string;
  threadId: string;
  body: string;
  source?: string;
  voiceFileRef?: string;
  status?: string;
  error?: string;
  transcriptionStartedAt?: string;
  pendingMessageId?: string;
};

export function appendOptimisticThreadNote(input: OptimisticThreadNoteInput): string {
  const ledger = ensureCoordinatorOwnedActiveLedger(currentLedgerStateId());
  const notesByThread = normalizeLedgerNotes(ledger);
  const notes = notesByThread[input.threadId] ?? [];
  const noteId = input.noteId ?? `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  if (notes.some((note) => String(note.id ?? '') === noteId)) return noteId;
  notes.push({
    id: noteId,
    role: 'operator',
    message: input.body,
    timestamp: input.createdAt ?? new Date().toISOString(),
    voiceFileRef: input.voiceFileRef ?? '',
    status: input.status ?? '',
    error: input.error ?? '',
    transcriptionStartedAt: input.transcriptionStartedAt ?? '',
    pendingMessageId: input.pendingMessageId ?? '',
    optimistic: true
  });
  notesByThread[input.threadId] = notes;
  void import('./render-thread-panel.js').then(({ renderThreadPanel }) => {
    if (globalThis.document) renderThreadPanel();
  }).catch(() => undefined);
  return noteId;
}
