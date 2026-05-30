/**
 * WHAT: Sidecar Markdown helpers for ledger-cli.
 * WHY: migrated ledgers store card bodies in individual files while CLI commands still need full card content.
 */
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { FileSystemPort } from '../../../lib/types.js';

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function workspaceRootForLedger(ledgerJsonFile: string): string {
  return dirname(dirname(resolve(ledgerJsonFile)));
}

function resolveContentFile(ledgerJsonFile: string, contentFile: unknown): string | null {
  if (typeof contentFile !== 'string' || !contentFile.endsWith('.md')) return null;
  const workspaceRoot = workspaceRootForLedger(ledgerJsonFile);
  const file = resolve(workspaceRoot, contentFile.replace(/^\.\//, ''));
  const inner = relative(workspaceRoot, file);
  return inner && !inner.startsWith('..') && !isAbsolute(inner) ? file : null;
}

async function readText(path: string, fs?: FileSystemPort): Promise<string> {
  return fs ? fs.readFile(path) : readFileWithNode(path);
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

async function readFileWithNode(path: string): Promise<string> {
  const { promises } = await import('node:fs');
  return promises.readFile(path, 'utf8');
}

export async function hydrateLedgerCardContent(ledger: unknown, ledgerJsonFile: string, fs?: FileSystemPort): Promise<unknown> {
  if (!isRecord(ledger) || !Array.isArray(ledger.cards)) return ledger;
  const cards = ledger.cards.filter(isRecord);
  for (const card of cards) {
    const comment = isRecord(card.comment) ? card.comment : {};
    const file = resolveContentFile(ledgerJsonFile, comment.contentFile);
    if (!file) continue;
    try {
      card.comment = { ...comment, what: await readText(file, fs) };
    } catch {
      // Missing sidecar files are ignored so legacy commands can still inspect partial ledgers.
    }
  }
  return ledger;
}

export async function writeCardCommentContent(input: { card: JsonObject; content: string; fs?: FileSystemPort; ledgerJsonFile: string }): Promise<void> {
  const comment = isRecord(input.card.comment) ? { ...input.card.comment } : {};
  const file = resolveContentFile(input.ledgerJsonFile, comment.contentFile);
  if (!file) {
    comment.what = input.content.trimEnd();
    input.card.comment = comment;
    return;
  }
  await writeText(file, input.content.trimEnd(), input.fs);
  delete comment.what;
  input.card.comment = comment;
}
