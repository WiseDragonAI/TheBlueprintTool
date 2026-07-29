/**
 * WHAT: Owns hydrated thread documents independently from replaceable navigation ledgers.
 * WHY: A navigation response intentionally omits thread content and must not erase a verified conversation.
 */
import { state, type ThreadContentRefreshScope, type ThreadDocumentState } from '../../state.js';

type AnyRecord = Record<string, any>;

function keyPart(value: unknown): string {
  return encodeURIComponent(String(value ?? '').trim());
}

export function threadDocumentStateKey(scope: Pick<ThreadContentRefreshScope, 'projectId' | 'replicaNodeId' | 'ledgerId' | 'threadId'>): string {
  return [scope.projectId, scope.replicaNodeId, scope.ledgerId, scope.threadId].map(keyPart).join('/');
}

function store(): Record<string, ThreadDocumentState> {
  state.threadDocumentsByScope ||= {};
  return state.threadDocumentsByScope as Record<string, ThreadDocumentState>;
}

export function installThreadDocumentState(scope: ThreadContentRefreshScope, document: ThreadDocumentState): void {
  store()[threadDocumentStateKey(scope)] = {
    contentFile: document.contentFile,
    notes: structuredClone(document.notes),
    deletedNoteIds: [...document.deletedNoteIds],
  };
}

export function threadDocumentState(scope: Pick<ThreadContentRefreshScope, 'projectId' | 'replicaNodeId' | 'ledgerId' | 'threadId'>): ThreadDocumentState | null {
  return store()[threadDocumentStateKey(scope)] ?? null;
}

export function restoreThreadDocumentsIntoLedger(input: {
  projectId: string;
  replicaNodeId: string;
  ledgerId: string;
  threadId?: string;
  ledger: AnyRecord | null | undefined;
}): void {
  if (!input.ledger || typeof input.ledger !== 'object' || Array.isArray(input.ledger)) return;
  const prefix = [input.projectId, input.replicaNodeId, input.ledgerId].map(keyPart).join('/');
  const documents = store();
  const exactKey = input.threadId ? `${prefix}/${keyPart(input.threadId)}` : '';
  const entries = exactKey
    ? (documents[exactKey] ? [[exactKey, documents[exactKey]] as const] : [])
    : Object.entries(documents);
  for (const [key, document] of entries) {
    if (!key.startsWith(`${prefix}/`)) continue;
    const threadId = decodeURIComponent(key.slice(prefix.length + 1));
    const existingNotes = Array.isArray(input.ledger.notes?.[threadId]) ? input.ledger.notes[threadId] as AnyRecord[] : [];
    const existingDeleted = Array.isArray(input.ledger.deletedNoteIds?.[threadId]) ? input.ledger.deletedNoteIds[threadId].map(String) : [];
    const deletedNoteIds = [...new Set([...document.deletedNoteIds, ...existingDeleted])];
    const deleted = new Set(deletedNoteIds);
    const notes = new Map<string, AnyRecord>();
    for (const note of [...document.notes, ...existingNotes]) {
      const noteId = String(note?.id ?? '');
      if (noteId && !deleted.has(noteId)) notes.set(noteId, structuredClone(note));
    }
    const retainedDocument = {
      contentFile: document.contentFile,
      notes: [...notes.values()],
      deletedNoteIds,
    };
    store()[key] = retainedDocument;
    input.ledger.threadFiles = { ...(input.ledger.threadFiles ?? {}), [threadId]: document.contentFile };
    input.ledger.notes = { ...(input.ledger.notes ?? {}), [threadId]: structuredClone(retainedDocument.notes) };
    input.ledger.deletedNoteIds = { ...(input.ledger.deletedNoteIds ?? {}), [threadId]: [...retainedDocument.deletedNoteIds] };
  }
}
