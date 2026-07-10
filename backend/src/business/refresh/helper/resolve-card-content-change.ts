/**
 * WHAT: Resolves one Markdown file change to its exact owning ledger and card or thread content reference.
 * WHY: Filesystem events must never refresh an unrelated ledger when ownership is absent or ambiguous.
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { readCanonicalDecisionOsState } from '../../ledger/helper/read-canonical-decision-os-state.js';

type AnyRecord = Record<string, unknown>;

export type CardContentChange = {
  contentFile: string;
  file: string;
  kind: 'card-content' | 'thread-content';
  ledgerId: string;
  threadId?: string;
};

export type ContentChangeCandidate = Pick<CardContentChange, 'contentFile' | 'file' | 'kind'>;

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function resolvedContentFile(decisionOsRoot: string, contentFile: unknown): string | null {
  // WHAT: Reject non-Markdown ownership references before resolving filesystem paths.
  // WHY: Only externalized card and thread Markdown participates in scoped content events.
  if (typeof contentFile !== 'string' || !contentFile.endsWith('.md')) return null;
  const relativePath = contentFile.replace(/^\/?\.decision-os\//, '');
  const file = resolve(decisionOsRoot, relativePath);
  return isInside(decisionOsRoot, file) ? file : null;
}

function ledgerDocuments(decisionOsRoot: string): Array<{ ledgerId: string; ledger: AnyRecord }> {
  const state = readCanonicalDecisionOsState({
    action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json') }
  });
  const entries = [
    ...state.ledgers.map((entry) => ({ ledgerId: entry.id, ledgerFile: entry.ledgerFile })),
    { ledgerId: 'ledgers-canvas', ledgerFile: '.decision-os/ledgers-canvas.json' }
  ];
  const documents: Array<{ ledgerId: string; ledger: AnyRecord }> = [];
  for (const entry of entries) {
    const ledgerPath = resolve(decisionOsRoot, String(entry.ledgerFile).replace(/^\/?\.decision-os\//, ''));
    // WHAT: Ignore missing ledger files and state entries that escape the active workspace.
    // WHY: Neither source can establish safe ownership for a content event.
    if (!isInside(decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) continue;
    try {
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
      // WHAT: Admit only object-shaped ledger documents to ownership scanning.
      // WHY: Arrays and primitives cannot contain the expected card or thread maps.
      if (isRecord(ledger)) documents.push({ ledgerId: entry.ledgerId, ledger });
    } catch {
      // WHAT: Ignore a partially written or invalid ledger for this ownership pass.
      // WHY: Emitting an unverified scope is less safe than waiting for the next watcher event.
    }
  }
  return documents;
}

export function resolveCardContentChange(input: {
  decisionOsRoot: string;
  change: ContentChangeCandidate;
}): CardContentChange | null {
  const targetFile = resolve(input.change.file);
  const owners: CardContentChange[] = [];
  for (const { ledgerId, ledger } of ledgerDocuments(input.decisionOsRoot)) {
    // WHAT: Resolve card ownership through the card's declared content file.
    // WHY: Card and thread ownership use different ledger structures.
    if (input.change.kind === 'card-content') {
      const cards = Array.isArray(ledger.cards) ? ledger.cards : [];
      const contentFile = cards
        .map((card) => isRecord(card) && isRecord(card.comment) ? card.comment.contentFile : undefined)
        .find((candidate) => resolvedContentFile(input.decisionOsRoot, candidate) === targetFile);
      if (typeof contentFile === 'string') owners.push({ ...input.change, contentFile, ledgerId });
      continue;
    }
    const threadFiles = isRecord(ledger.threadFiles) ? ledger.threadFiles : {};
    for (const [threadId, contentFile] of Object.entries(threadFiles)) {
      // WHAT: Retain only exact file matches with a string ownership reference.
      // WHY: Non-string metadata cannot form the browser's scoped refresh contract.
      if (resolvedContentFile(input.decisionOsRoot, contentFile) !== targetFile || typeof contentFile !== 'string') continue;
      owners.push({ ...input.change, contentFile, ledgerId, threadId });
    }
  }
  return owners.length === 1 ? owners[0] : null;
}
