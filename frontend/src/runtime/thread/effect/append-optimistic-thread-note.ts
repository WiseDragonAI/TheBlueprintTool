/**
 * WHAT: Adds a local thread note before the backend answers.
 * WHY: Text and voice notes must be visible immediately and survive failed reconciliation.
 */
import { state } from '../../state.js';

export type OptimisticThreadNoteInput = {
  threadId: string;
  body: string;
  source?: string;
  voiceFileRef?: string;
  status?: string;
  error?: string;
};

export function appendOptimisticThreadNote(input: OptimisticThreadNoteInput): string {
  const ledger = state.activeLedger ?? { notes: {} };
  const notesByThread = ledger.notes ?? {};
  const notes = notesByThread[input.threadId] ?? [];
  const noteId = `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  notes.push({
    id: noteId,
    role: input.source === 'voice' ? 'voice' : 'operator',
    message: input.body,
    timestamp: new Date().toISOString(),
    voiceFileRef: input.voiceFileRef ?? '',
    status: input.status ?? '',
    error: input.error ?? '',
    optimistic: true
  });
  notesByThread[input.threadId] = notes;
  ledger.notes = notesByThread;
  state.activeLedger = ledger;
  void import('./render-thread-panel.js').then(({ renderThreadPanel }) => {
    if (globalThis.document) renderThreadPanel();
  }).catch(() => undefined);
  return noteId;
}
