/**
 * WHAT: Reads and writes card markdown sidecar files referenced from ledger JSON.
 * WHY: card bodies should be patchable as individual Markdown files while the browser keeps its hydrated runtime contract.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, basename } from 'node:path';

type AnyRecord = Record<string, unknown>;

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

function commentFor(card: AnyRecord): AnyRecord {
  return isRecord(card.comment) ? card.comment : {};
}

export function cardContentFileRef(ledgerPath: string, card: AnyRecord): string {
  return `.blueprinttool/cards/${safeSegment(ledgerStem(ledgerPath))}/${safeSegment(card.id)}.md`;
}

export function resolveCardContentFile(blueprinttoolRoot: string, contentFile: unknown): string | null {
  if (typeof contentFile !== 'string' || !contentFile.endsWith('.md')) return null;
  const relativePath = contentFile.replace(/^\.blueprinttool\//, '');
  const file = resolve(blueprinttoolRoot, relativePath);
  return isInside(blueprinttoolRoot, file) ? file : null;
}

export function hydrateLedgerCardContent(ledger: AnyRecord, blueprinttoolRoot: string): AnyRecord {
  const cards = Array.isArray(ledger.cards) ? ledger.cards as AnyRecord[] : [];
  for (const card of cards) {
    const comment = commentFor(card);
    const file = resolveCardContentFile(blueprinttoolRoot, comment.contentFile);
    if (!file || !existsSync(file)) continue;
    card.comment = { ...comment, what: readFileSync(file, 'utf8') };
  }
  return ledger;
}

export function writeCardDescriptionSidecar(input: { blueprinttoolRoot: string; card: AnyRecord; description: string; ledgerPath: string }): void {
  const comment = commentFor(input.card);
  const contentFile = typeof comment.contentFile === 'string' ? comment.contentFile : cardContentFileRef(input.ledgerPath, input.card);
  const file = resolveCardContentFile(input.blueprinttoolRoot, contentFile);
  if (!file) throw new Error(`Invalid card content file for ${String(input.card.id ?? '')}`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, input.description, 'utf8');
  const nextComment: AnyRecord = { ...comment, contentFile };
  delete nextComment.what;
  input.card.comment = nextComment;
}

export function externalizeCardContent(input: { blueprinttoolRoot: string; card: AnyRecord; ledgerPath: string }): void {
  const comment = commentFor(input.card);
  if (typeof comment.what !== 'string') return;
  writeCardDescriptionSidecar({
    blueprinttoolRoot: input.blueprinttoolRoot,
    card: input.card,
    description: comment.what,
    ledgerPath: input.ledgerPath,
  });
}

export function duplicateCardContentSidecar(input: { blueprinttoolRoot: string; ledgerPath: string; sourceCard: AnyRecord; targetCard: AnyRecord }): void {
  const sourceComment = commentFor(input.sourceCard);
  const sourceFile = resolveCardContentFile(input.blueprinttoolRoot, sourceComment.contentFile);
  const sourceBody = sourceFile && existsSync(sourceFile)
    ? readFileSync(sourceFile, 'utf8')
    : typeof sourceComment.what === 'string'
      ? sourceComment.what
      : undefined;
  if (sourceBody === undefined) return;
  writeCardDescriptionSidecar({
    blueprinttoolRoot: input.blueprinttoolRoot,
    card: input.targetCard,
    description: sourceBody,
    ledgerPath: input.ledgerPath,
  });
}
