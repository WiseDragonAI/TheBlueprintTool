/**
 * WHAT: Resolves the current locally owned Markdown file for one ledger card identity.
 * WHY: Card authoring APIs must never accept a browser-provided content path.
 */
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { resolveCardContentFile } from './card-content-file.js';
import { sha256AuthoredBytes } from '../../content-authoring/helper/authored-file-git-revisions.js';

type AnyRecord = Record<string, unknown>;

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)))
    : [];
}

function contained(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

export type LedgerCardContentOwner = {
  card: AnyRecord;
  file: string;
  markdown: string;
  contentRevision: string;
};

export function resolveLedgerCardContentOwner(input: {
  decisionOsRoot: string;
  ledger: AnyRecord;
  cardId: string;
}): LedgerCardContentOwner | null {
  const card = records(input.ledger.cards).find((candidate) => String(candidate.id ?? '') === input.cardId);
  if (!card) return null;
  const comment = card.comment && typeof card.comment === 'object' && !Array.isArray(card.comment)
    ? card.comment as AnyRecord
    : {};
  const file = resolveCardContentFile(input.decisionOsRoot, comment.contentFile);
  if (!file || !existsSync(file)) return null;
  try {
    if (lstatSync(file).isSymbolicLink() || !lstatSync(file).isFile()) return null;
    const canonicalRoot = realpathSync(input.decisionOsRoot);
    const canonicalFile = realpathSync(file);
    if (!contained(canonicalRoot, canonicalFile)) return null;
    const bytes = readFileSync(canonicalFile);
    const markdown = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { card, file: canonicalFile, markdown, contentRevision: sha256AuthoredBytes(bytes) };
  } catch {
    return null;
  }
}
