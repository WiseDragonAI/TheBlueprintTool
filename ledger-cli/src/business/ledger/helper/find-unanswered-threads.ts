/**
 * WHAT: Finds ledger threads with meaningful notes awaiting an agent answer.
 * WHY: the ledger acts as the operator-to-agent communication queue.
 */
import type { UnansweredThread } from '../../../lib/types.js';
import { threadContentFileRef } from './thread-sidecar.js';

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isMeaningfulNote(note: JsonObject): boolean {
  return Boolean(text(note.role) || text(note.message) || text(note.body) || text(note.status) || text(note.voiceFileRef));
}

function isAgentAnswer(note: JsonObject): boolean {
  const role = text(note.role).toLowerCase();
  return role === 'agent' || role === 'assistant';
}

function toThreadNote(note: JsonObject) {
  return {
    error: text(note.error),
    id: text(note.id),
    message: text(note.message) || text(note.body),
    role: text(note.role),
    status: text(note.status),
    timestamp: text(note.timestamp),
    voiceFileRef: text(note.voiceFileRef),
  };
}

function findLastAgentIndex(notes: JsonObject[]): number {
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    if (isAgentAnswer(notes[index])) return index;
  }
  return -1;
}

function targetIdFromThreadId(threadId: string): string {
  return threadId.replace(/^thread-/, '');
}

function titleForThread(ledger: JsonObject, threadId: string): string {
  const targetId = targetIdFromThreadId(threadId);
  const cards = Array.isArray(ledger.cards) ? ledger.cards.filter(isRecord) : [];
  const annotations = Array.isArray(ledger.annotations) ? ledger.annotations.filter(isRecord) : [];
  const card = cards.find((candidate) => text(candidate.id) === targetId);
  const annotation = annotations.find((candidate) => text(candidate.id) === targetId);
  return text(card?.title) || text(annotation?.label) || targetId || threadId;
}

function threadFileForThread(ledger: JsonObject, ledgerJsonFile: string, threadId: string): string {
  if (isRecord(ledger.threadFiles) && typeof ledger.threadFiles[threadId] === 'string') {
    return ledger.threadFiles[threadId];
  }
  return threadContentFileRef(ledgerJsonFile, threadId);
}

function editInstructionForThread(threadFile: string): string {
  return `Patch ${threadFile} directly. Append one parsed answer section: # AGENT, then <!-- corev2:note {"id":"note-agent-<unique>","timestamp":"<ISO-8601>"} -->, then the answer markdown. Only # OPERATOR and # AGENT are valid top-level message headings; do not regenerate ledger JSON for the reply.`;
}

export function findUnansweredThreads(ledger: unknown, ledgerJsonFile: string): UnansweredThread[] {
  if (!isRecord(ledger) || !isRecord(ledger.notes)) return [];
  return Object.entries(ledger.notes).flatMap(([threadId, rawNotes]) => {
    const notes = Array.isArray(rawNotes) ? rawNotes.filter(isRecord) : [];
    const meaningfulNotes = notes.filter(isMeaningfulNote);
    const lastAgentIndex = findLastAgentIndex(meaningfulNotes);
    const pendingNotes = meaningfulNotes.slice(lastAgentIndex + 1).filter((note) => !isAgentAnswer(note));
    const lastNote = pendingNotes.at(-1);
    if (!lastNote) return [];
    const threadFile = threadFileForThread(ledger, ledgerJsonFile, threadId);
    return [{
      answerCommand: `ledger-cli answer --ledger ${JSON.stringify(ledgerJsonFile)} --thread-id ${JSON.stringify(threadId)} --message ${JSON.stringify('...')}`,
      editInstruction: editInstructionForThread(threadFile),
      lastNote: toThreadNote(lastNote),
      pendingNotes: pendingNotes.map(toThreadNote),
      targetId: targetIdFromThreadId(threadId),
      threadFile,
      threadId,
      title: titleForThread(ledger, threadId),
    }];
  });
}
