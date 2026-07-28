/**
 * WHAT: Persists normalized Codex run events as ordered, deduplicated notes in the owning card thread.
 * WHY: Durable lifecycle ingestion must update only the thread file and its ownership metadata.
 */
import { existsSync, readFileSync } from 'node:fs';
import { hydrateLedgerThreadNotesFor, resolveThreadContentFile, stripHydratedThreadNotes, writeThreadNotesFile } from '@backend/business/ledger/helper/thread-content-file.js';
import { normalizeLedgerNotes } from '@backend/business/server/helper/normalize-ledger-notes.js';
import { type NormalizedRunEvent } from '../helper/card-skill-run-event-types.js';
import { resolveCardSkillRunOwnership } from '../helper/resolve-card-skill-run-ownership.js';
import { queueLedgerProjectionPersistence } from '@backend/business/task-state/helper/persist-ledger-projection.js';
import { hasLedgerProjectionSource, readLedgerProjection } from '@backend/business/task-state/helper/read-ledger-projection.js';

type AnyRecord = Record<string, unknown>;

function safeSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function noteCodexLine(note: AnyRecord): number {
  const line = Number(note.codexLine ?? 0);
  return Number.isFinite(line) && line > 0 ? line : 0;
}

export function persistCardSkillRunEvents(input: {
  decisionOsRoot: string;
  ledgerId?: string;
  ledgerPath: string;
  cardId: string;
  runId: string;
  events: NormalizedRunEvent[];
  runtime?: AnyRecord;
}): number {
  // WHAT: Reject persistence when the declared owning ledger no longer exists.
  // WHY: Falling back to a different ledger could leak lifecycle notes across scopes.
  if (!hasLedgerProjectionSource({ ledgerId: input.ledgerId ?? '', ledgerPath: input.ledgerPath, runtime: input.runtime })) {
    throw new Error(`Ledger source not found: ${input.ledgerPath}`);
  }
  const ledger = input.ledgerId === 'tasks'
    ? readLedgerProjection({ ledgerId: input.ledgerId, ledgerPath: input.ledgerPath, runtime: input.runtime })
    : JSON.parse(readFileSync(input.ledgerPath, 'utf8')) as AnyRecord;
  // WHAT: Keep lifecycle events for every card-owned run exclusively in its run artifacts.
  // WHY: Conversation threads contain operator messages and direct final replies, not synthetic diagnostics.
  if (resolveCardSkillRunOwnership({
    ledger,
    decisionOsRoot: input.decisionOsRoot,
    cardId: input.cardId,
    runId: input.runId,
  }).found) return 0;
  const threadId = `thread-${input.cardId}`;
  const existingThreadFiles = ledger.threadFiles && typeof ledger.threadFiles === 'object' && !Array.isArray(ledger.threadFiles)
    ? ledger.threadFiles as Record<string, unknown>
    : {};
  const previousThreadFile = String(existingThreadFiles[threadId] ?? '');
  const resolvedThreadFile = resolveThreadContentFile(input.decisionOsRoot, previousThreadFile);
  // WHAT: Refuse legacy event persistence when its declared thread bytes were not materialized at admission.
  // WHY: A timer callback cannot safely fetch relay content and must never replace the thread with synthetic run events.
  if (previousThreadFile && (!resolvedThreadFile || !existsSync(resolvedThreadFile))) {
    throw new Error(`task_content_not_materialized:${previousThreadFile}`);
  }
  hydrateLedgerThreadNotesFor(ledger, input.decisionOsRoot, threadId);
  const notesByThread = normalizeLedgerNotes(ledger);
  const notes = notesByThread[threadId] ?? [];
  const byId = new Map(notes.map((note) => [String(note.id ?? ''), note]));
  let changed = 0;
  for (const event of input.events) {
    // WHAT: Ignore normalized records that intentionally have no durable representation.
    // WHY: The JSONL artifact remains the source for empty or diagnostic-only records.
    if (!event.persist) continue;
    const id = `codex-${safeSegment(input.runId)}-line-${event.line}`;
    // WHAT: Preserve exactly-once persistence by deterministic run-line identity.
    // WHY: Timer and settlement flushes may overlap the same source batch.
    if (byId.has(id)) continue;
    const nextNote: AnyRecord = {
      id,
      role: 'agent',
      message: event.text || event.title,
      timestamp: new Date().toISOString(),
      status: event.status || event.title,
      codexRunId: input.runId,
      codexLine: String(event.line),
      codexKind: event.kind,
      codexEventType: event.type,
      codexItemId: event.itemId,
      codexTool: event.tool,
      codexExitCode: event.exitCode,
    };
    const insertAt = notes.findIndex((note) => String(note.codexRunId ?? '') === input.runId && noteCodexLine(note) > event.line);
    // WHAT: Insert continuation events by physical line order when earlier events already exist.
    // WHY: Thread history must match the JSONL event sequence across batched writes.
    if (insertAt >= 0) notes.splice(insertAt, 0, nextNote);
    else notes.push(nextNote);
    byId.set(id, nextNote);
    changed += 1;
  }
  // WHAT: Keep a no-op batch fully write-free.
  // WHY: Duplicate settlement flushes must not change ledger or thread mtimes.
  if (changed === 0) return 0;

  notesByThread[threadId] = notes;
  // WHAT: Write the durable thread content before updating newly assigned ownership metadata.
  // WHY: The filesystem watcher publishes the scoped thread event from the durable content write.
  writeThreadNotesFile({ decisionOsRoot: input.decisionOsRoot, ledger, ledgerPath: input.ledgerPath, threadId, notes });
  const currentThreadFiles = ledger.threadFiles && typeof ledger.threadFiles === 'object' && !Array.isArray(ledger.threadFiles)
    ? ledger.threadFiles as Record<string, unknown>
    : {};
  const assignedThreadFile = String(currentThreadFiles[threadId] ?? '') !== previousThreadFile;
  queueLedgerProjectionPersistence({
    decisionOsRoot: input.decisionOsRoot,
    ledgerId: input.ledgerId,
    ledgerPath: input.ledgerPath,
    ledger,
    runtime: input.runtime,
    command: {
      kind: 'persist-skill-run-notes',
      threadIds: [threadId],
      threadNoteIds: { [threadId]: input.events.filter((event) => event.persist).map((event) => `codex-${safeSegment(input.runId)}-line-${event.line}`) },
      ...(assignedThreadFile ? { ledgerPaths: [`threadFiles/${threadId}`] } : {}),
    },
  });
  stripHydratedThreadNotes(ledger);
  return changed;
}
