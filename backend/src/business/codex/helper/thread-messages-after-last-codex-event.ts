/**
 * WHAT: Selects operator thread messages written after the latest persisted Codex event for one run.
 * WHY: Continuation controllers need message-boundary derivation separate from process-spawn behavior.
 */
import { hydrateLedgerThreadNotes } from '@backend/business/ledger/helper/thread-content-file.js';
import { normalizeLedgerNotes } from '@backend/business/server/helper/normalize-ledger-notes.js';
import { isCodexThreadArtifactNote } from './is-codex-thread-artifact-note.js';

type AnyRecord = Record<string, unknown>;

export type ThreadMessageContinuation = {
  messages: AnyRecord[];
  debug: AnyRecord;
};

function textPreview(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

export function threadMessagesAfterLastCodexEvent(input: {
  ledger: AnyRecord;
  decisionOsRoot: string;
  cardId: string;
  runId: string;
  traceId?: string;
}): ThreadMessageContinuation {
  hydrateLedgerThreadNotes(input.ledger, input.decisionOsRoot);
  const threadId = `thread-${input.cardId}`;
  const notes = normalizeLedgerNotes(input.ledger)[threadId] ?? [];
  let latestCompletedIndex = -1;
  let latestCodexIndex = -1;
  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    // WHAT: Ignore Codex artifacts owned by other runs when locating the continuation boundary.
    // WHY: A card thread may contain lifecycle history from several run IDs.
    if (String(note.codexRunId ?? '') !== input.runId) continue;
    latestCodexIndex = index;
    // WHAT: Track the latest explicit completed turn alongside the latest event.
    // WHY: Older stored histories may not contain events after their completion marker.
    if (String(note.codexEventType ?? '') === 'turn.completed') latestCompletedIndex = index;
  }
  const boundaryIndex = latestCodexIndex > latestCompletedIndex ? latestCodexIndex : latestCompletedIndex;
  const messages = notes.filter((note, index) => {
    // WHAT: Exclude persisted Codex lifecycle and output artifacts from the next prompt.
    // WHY: Continuation should send only newer operator-authored messages.
    if (isCodexThreadArtifactNote(note)) return false;
    // WHAT: Exclude empty notes from prompt construction.
    // WHY: They do not provide actionable continuation context.
    if (!String(note.message ?? note.body ?? '').trim()) return false;
    return index > boundaryIndex;
  });
  return {
    messages,
    debug: {
      traceId: input.traceId,
      runId: input.runId,
      cardId: input.cardId,
      threadId,
      notesCount: notes.length,
      latestCompletedIndex,
      latestCodexIndex,
      boundaryIndex,
      messageCount: messages.length,
      candidateIds: messages.map((note) => String(note.id ?? '')).slice(0, 12),
      candidatePreviews: messages.map((note) => textPreview(note.message ?? note.body)).slice(0, 4),
      lastNotes: notes.slice(-8).map((note, offset) => ({
        index: notes.length - notes.slice(-8).length + offset,
        id: String(note.id ?? ''),
        role: String(note.role ?? ''),
        codexRunId: String(note.codexRunId ?? ''),
        codexEventType: String(note.codexEventType ?? ''),
        status: String(note.status ?? ''),
        preview: textPreview(note.message ?? note.body),
      })),
    }
  };
}
