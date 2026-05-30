/**
 * WHAT: Appends an agent answer note to a ledger thread.
 * WHY: agents answer operator prompts by writing back into the ledger communication layer.
 */
import { randomUUID } from 'node:crypto';
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { writeThreadNotesSidecar } from './thread-sidecar.js';

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readMessageFile(path: string, fs?: FileSystemPort): Promise<string> {
  if (fs) return fs.readFile(path);
  const { promises } = await import('node:fs');
  return promises.readFile(path, 'utf8');
}

export async function appendThreadAnswer(
  ledger: unknown,
  operation: { message?: string; messageFile?: string; threadId?: string } | undefined,
  ledgerJsonFile: string,
  fs?: FileSystemPort,
): Promise<Result<unknown>> {
  const threadId = String(operation?.threadId ?? '').trim();
  if (!threadId) return { ok: false, error: 'Answer command requires --thread-id.' };
  const message = String(operation?.message ?? (operation?.messageFile ? await readMessageFile(operation.messageFile, fs) : '')).trimEnd();
  if (!message.trim()) return { ok: false, error: 'Answer command requires --message or --message-file.' };
  if (!isRecord(ledger)) return { ok: false, error: 'Answer command requires an object ledger.' };
  const nextLedger: JsonObject = { ...ledger };
  const notes = isRecord(nextLedger.notes) ? { ...nextLedger.notes } : {};
  const threadNotes = Array.isArray(notes[threadId]) ? [...notes[threadId] as unknown[]] : [];
  const note = {
    id: `note-agent-${Date.now()}-${randomUUID()}`,
    role: 'agent',
    message,
    timestamp: new Date().toISOString(),
  };
  threadNotes.push(note);
  notes[threadId] = threadNotes;
  nextLedger.notes = notes;
  await writeThreadNotesSidecar({ ledger: nextLedger, ledgerJsonFile, threadId, notes: threadNotes.filter(isRecord), fs });
  return { ok: true, value: nextLedger };
}
