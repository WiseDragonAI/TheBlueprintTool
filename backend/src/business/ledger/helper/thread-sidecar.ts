/**
 * WHAT: Reads and writes thread conversations as Markdown sidecar files.
 * WHY: agents should answer by patching a thread file instead of regenerating ledger JSON note arrays.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, basename } from 'node:path';

type AnyRecord = Record<string, unknown>;

const metadataPrefix = '<!-- corev2:note ';
const metadataSuffix = ' -->';

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function ledgerStem(ledgerPath: string): string {
  return basename(ledgerPath, extname(ledgerPath));
}

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function noteRole(note: AnyRecord): 'agent' | 'operator' {
  const role = String(note.role ?? '').toLowerCase();
  return role === 'agent' || role === 'assistant' ? 'agent' : 'operator';
}

function headingForRole(role: unknown): 'AGENT' | 'OPERATOR' {
  const normalized = String(role ?? '').toLowerCase();
  return normalized === 'agent' || normalized === 'assistant' ? 'AGENT' : 'OPERATOR';
}

function parseMetadata(line: string): AnyRecord | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith(metadataPrefix) || !trimmed.endsWith(metadataSuffix)) return null;
  try {
    const raw = trimmed.slice(metadataPrefix.length, -metadataSuffix.length);
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function metadataFor(note: AnyRecord): AnyRecord {
  const metadata: AnyRecord = {};
  for (const key of ['id', 'timestamp', 'voiceFileRef', 'status', 'transcriptionStartedAt', 'error']) {
    if (typeof note[key] === 'string' && note[key]) metadata[key] = note[key];
  }
  return metadata;
}

function normalizeNotesMap(ledger: AnyRecord): Record<string, AnyRecord[]> {
  if (!isRecord(ledger.notes)) ledger.notes = {};
  return ledger.notes as Record<string, AnyRecord[]>;
}

function normalizeThreadFiles(ledger: AnyRecord): Record<string, string> {
  if (!isRecord(ledger.threadFiles)) ledger.threadFiles = {};
  return ledger.threadFiles as Record<string, string>;
}

export function threadContentFileRef(ledgerPath: string, threadId: string): string {
  return `.blueprinttool/threads/${safeSegment(ledgerStem(ledgerPath))}/${safeSegment(threadId)}.md`;
}

export function resolveThreadContentFile(blueprinttoolRoot: string, contentFile: unknown): string | null {
  if (typeof contentFile !== 'string' || !contentFile.endsWith('.md')) return null;
  const relativePath = contentFile.replace(/^\.blueprinttool\//, '');
  const file = resolve(blueprinttoolRoot, relativePath);
  return isInside(blueprinttoolRoot, file) ? file : null;
}

export function parseThreadMarkdown(markdown: string): AnyRecord[] {
  const notes: AnyRecord[] = [];
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let current: AnyRecord | null = null;
  let body: string[] = [];

  function flush(): void {
    if (!current) return;
    const message = body.join('\n').replace(/^\n+|\n+$/g, '');
    current.message = message;
    notes.push(current);
  }

  for (const line of lines) {
    const heading = line.match(/^#\s+(OPERATOR|AGENT)\s*$/i);
    if (heading) {
      flush();
      current = {
        id: `note-${notes.length + 1}`,
        role: heading[1].toLowerCase() === 'agent' ? 'agent' : 'operator',
        message: '',
        timestamp: '',
      };
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

export function formatThreadMarkdown(notes: AnyRecord[]): string {
  return `${notes.map((note) => {
    const metadata = metadataFor(note);
    const body = String(note.message ?? note.body ?? '').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
    return [`# ${headingForRole(note.role)}`, `${metadataPrefix}${JSON.stringify(metadata)}${metadataSuffix}`, '', body].join('\n').replace(/\n+$/g, '');
  }).join('\n\n')}\n`;
}

export function hydrateLedgerThreadNotes(ledger: AnyRecord, blueprinttoolRoot: string): AnyRecord {
  const threadFiles = isRecord(ledger.threadFiles) ? ledger.threadFiles as Record<string, unknown> : {};
  const notes = normalizeNotesMap(ledger);
  for (const [threadId, contentRef] of Object.entries(threadFiles)) {
    const file = resolveThreadContentFile(blueprinttoolRoot, contentRef);
    if (!file || !existsSync(file)) continue;
    notes[threadId] = parseThreadMarkdown(readFileSync(file, 'utf8'));
  }
  return ledger;
}

export function writeThreadNotesSidecar(input: { blueprinttoolRoot: string; ledger: AnyRecord; ledgerPath: string; threadId: string; notes: AnyRecord[] }): void {
  const threadFiles = normalizeThreadFiles(input.ledger);
  const contentFile = threadFiles[input.threadId] ?? threadContentFileRef(input.ledgerPath, input.threadId);
  const file = resolveThreadContentFile(input.blueprinttoolRoot, contentFile);
  if (!file) throw new Error(`Invalid thread content file for ${input.threadId}`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, formatThreadMarkdown(input.notes), 'utf8');
  threadFiles[input.threadId] = contentFile;
}

export function stripHydratedThreadNotes(ledger: AnyRecord): AnyRecord {
  if (!isRecord(ledger.notes) || !isRecord(ledger.threadFiles)) return ledger;
  const notes = { ...ledger.notes } as Record<string, unknown>;
  for (const threadId of Object.keys(ledger.threadFiles)) delete notes[threadId];
  ledger.notes = notes;
  return ledger;
}
