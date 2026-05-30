/**
 * WHAT: Adds a local thread note before the backend answers.
 * WHY: Text and voice notes must be visible immediately and survive failed reconciliation.
 */
import { state } from '../../state.js';
import { normalizeLedgerNotes } from '../../ledger/helper/normalize-ledger-notes.js';

export type OptimisticThreadNoteInput = {
  threadId: string;
  body: string;
  source?: string;
  voiceFileRef?: string;
  status?: string;
  error?: string;
  transcriptionStartedAt?: string;
};

export function appendOptimisticThreadNote(input: OptimisticThreadNoteInput): string {
  const ledger = state.activeLedger ?? { notes: {} };
  const notesByThread = normalizeLedgerNotes(ledger);
  const notes = notesByThread[input.threadId] ?? [];
  const noteId = `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  notes.push({
    id: noteId,
    role: 'operator',
    message: input.body,
    timestamp: new Date().toISOString(),
    voiceFileRef: input.voiceFileRef ?? '',
    status: input.status ?? '',
    error: input.error ?? '',
    transcriptionStartedAt: input.transcriptionStartedAt ?? '',
    optimistic: true
  });
  notesByThread[input.threadId] = notes;
  state.activeLedger = ledger;
  void import('./render-thread-panel.js').then(({ renderThreadPanel }) => {
    if (globalThis.document) renderThreadPanel();
  }).catch(() => undefined);
  return noteId;
}
