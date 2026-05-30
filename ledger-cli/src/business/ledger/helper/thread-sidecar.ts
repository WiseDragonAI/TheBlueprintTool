/**
 * WHAT: Thread Markdown sidecar helpers for ledger-cli.
 * WHY: agents should answer conversations by patching or appending to Markdown files.
 */
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import type { FileSystemPort } from '../../../lib/types.js';

type JsonObject = Record<string, unknown>;

const metadataPrefix = '<!-- corev2:note ';
const metadataSuffix = ' -->';

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function workspaceRootForLedger(ledgerJsonFile: string): string {
  return dirname(dirname(resolve(ledgerJsonFile)));
}

function ledgerStem(ledgerJsonFile: string): string {
  return basename(ledgerJsonFile, extname(ledgerJsonFile));
}

export function threadContentFileRef(ledgerJsonFile: string, threadId: string): string {
  return `.blueprinttool/threads/${safeSegment(ledgerStem(ledgerJsonFile))}/${safeSegment(threadId)}.md`;
}

function resolveContentFile(ledgerJsonFile: string, contentFile: unknown): string | null {
  if (typeof contentFile !== 'string' || !contentFile.endsWith('.md')) return null;
  const workspaceRoot = workspaceRootForLedger(ledgerJsonFile);
  const file = resolve(workspaceRoot, contentFile.replace(/^\.\//, ''));
  const inner = relative(workspaceRoot, file);
  return inner && !inner.startsWith('..') && !isAbsolute(inner) ? file : null;
}

async function readText(path: string, fs?: FileSystemPort): Promise<string> {
  if (fs) return fs.readFile(path);
  const { promises } = await import('node:fs');
  return promises.readFile(path, 'utf8');
}

async function writeText(path: string, content: string, fs?: FileSystemPort): Promise<void> {
  if (fs) {
    await fs.mkdir(dirname(path));
    await fs.writeFile(path, content);
    return;
  }
  const { promises } = await import('node:fs');
  await promises.mkdir(dirname(path), { recursive: true });
  await promises.writeFile(path, content, 'utf8');
}

function parseMetadata(line: string): JsonObject | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith(metadataPrefix) || !trimmed.endsWith(metadataSuffix)) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(metadataPrefix.length, -metadataSuffix.length));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function noteRole(note: JsonObject): 'agent' | 'operator' {
  const role = String(note.role ?? '').toLowerCase();
  return role === 'agent' || role === 'assistant' ? 'agent' : 'operator';
}

function headingForRole(role: unknown): 'AGENT' | 'OPERATOR' {
  const normalized = String(role ?? '').toLowerCase();
  return normalized === 'agent' || normalized === 'assistant' ? 'AGENT' : 'OPERATOR';
}

function metadataFor(note: JsonObject): JsonObject {
  const metadata: JsonObject = {};
  for (const key of ['id', 'timestamp', 'voiceFileRef', 'status', 'transcriptionStartedAt', 'error']) {
    if (typeof note[key] === 'string' && note[key]) metadata[key] = note[key];
  }
  return metadata;
}

export function parseThreadMarkdown(markdown: string): JsonObject[] {
  const notes: JsonObject[] = [];
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let current: JsonObject | null = null;
  let body: string[] = [];

  function flush(): void {
    if (!current) return;
    current.message = body.join('\n').replace(/^\n+|\n+$/g, '');
    notes.push(current);
  }

  for (const line of lines) {
    const heading = line.match(/^#\s+(OPERATOR|AGENT)\s*$/i);
    if (heading) {
      flush();
      current = { id: `note-${notes.length + 1}`, role: heading[1].toLowerCase() === 'agent' ? 'agent' : 'operator', message: '', timestamp: '' };
      body = [];
      continue;
    }
    if (!current) continue;
    if (body.length === 0) {
      const metadata = parseMetadata(line);
      if (metadata) {
        current = { ...current, ...metadata, role: noteRole({ ...current, ...metadata }) };
        continue;
      }
      if (!line.trim()) continue;
    }
    body.push(line);
  }
  flush();
  return notes;
}

export function formatThreadMarkdown(notes: JsonObject[]): string {
  return `${notes.map((note) => {
    const body = String(note.message ?? note.body ?? '').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
    return [`# ${headingForRole(note.role)}`, `${metadataPrefix}${JSON.stringify(metadataFor(note))}${metadataSuffix}`, '', body].join('\n').replace(/\n+$/g, '');
  }).join('\n\n')}\n`;
}

export async function hydrateLedgerThreadNotes(ledger: unknown, ledgerJsonFile: string, fs?: FileSystemPort): Promise<unknown> {
  if (!isRecord(ledger) || !isRecord(ledger.threadFiles)) return ledger;
  const notes = isRecord(ledger.notes) ? ledger.notes as Record<string, unknown> : {};
  for (const [threadId, contentFile] of Object.entries(ledger.threadFiles)) {
    const file = resolveContentFile(ledgerJsonFile, contentFile);
    if (!file) continue;
    try {
      notes[threadId] = parseThreadMarkdown(await readText(file, fs));
    } catch {
      // Missing thread sidecars should not block inspection of partial ledgers.
    }
  }
  ledger.notes = notes;
  return ledger;
}

export async function writeThreadNotesSidecar(input: { ledger: JsonObject; ledgerJsonFile: string; threadId: string; notes: JsonObject[]; fs?: FileSystemPort }): Promise<void> {
  const threadFiles = isRecord(input.ledger.threadFiles) ? { ...input.ledger.threadFiles } as Record<string, string> : {};
  const contentFile = threadFiles[input.threadId] ?? threadContentFileRef(input.ledgerJsonFile, input.threadId);
  const file = resolveContentFile(input.ledgerJsonFile, contentFile);
  if (!file) throw new Error(`Invalid thread content file for ${input.threadId}`);
  await writeText(file, formatThreadMarkdown(input.notes), input.fs);
  threadFiles[input.threadId] = contentFile;
  input.ledger.threadFiles = threadFiles;
}

export function stripHydratedThreadNotes(ledger: unknown): unknown {
  if (!isRecord(ledger) || !isRecord(ledger.notes) || !isRecord(ledger.threadFiles)) return ledger;
  const notes = { ...ledger.notes } as Record<string, unknown>;
  for (const threadId of Object.keys(ledger.threadFiles)) delete notes[threadId];
  ledger.notes = notes;
  return ledger;
}
