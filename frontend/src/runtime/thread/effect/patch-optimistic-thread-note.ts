/**
 * WHAT: Patches a local optimistic thread note in place.
 * WHY: Upload, transcription, retry, and server-sync states must never remove the visible note.
 */
import { state } from '../../state.js';
import { normalizeLedgerNotes } from '../../ledger/helper/normalize-ledger-notes.js';

export type OptimisticThreadNotePatch = {
  threadId: string;
  noteId: string;
  body?: string;
  voiceFileRef?: string;
  status?: string;
  error?: string;
  transcriptionStartedAt?: string;
  optimistic?: boolean;
};

export function patchOptimisticThreadNote(input: OptimisticThreadNotePatch): boolean {
  if (!state.activeLedger) return false;
  const notes = normalizeLedgerNotes(state.activeLedger)[input.threadId] ?? [];
  const note = notes.find((entry) => String(entry.id ?? '') === input.noteId);
  if (!note) return false;
  if (typeof input.body === 'string') note.message = input.body;
  if (typeof input.voiceFileRef === 'string') note.voiceFileRef = input.voiceFileRef;
  if (typeof input.status === 'string') note.status = input.status;
  if (typeof input.error === 'string') note.error = input.error;
  if (typeof input.transcriptionStartedAt === 'string') note.transcriptionStartedAt = input.transcriptionStartedAt;
  if (typeof input.optimistic === 'boolean') note.optimistic = input.optimistic;
  note.updatedAt = new Date().toISOString();
  void import('./render-thread-panel.js').then(({ renderThreadPanel }) => {
    if (globalThis.document) renderThreadPanel();
  }).catch(() => undefined);
  return true;
}
