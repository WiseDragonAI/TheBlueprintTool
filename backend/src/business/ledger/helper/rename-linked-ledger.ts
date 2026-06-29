/**
 * WHAT: Renames a ledger through its parent canvas card.
 * WHY: Ledger title, route id, JSON filename, and normalized card/thread paths must move together.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { writeCanonicalDecisionOsState } from '../effect/write-canonical-decision-os-state.js';
import { ledgerSlug } from './ledger-slug.js';
import { readCanonicalDecisionOsState } from './read-canonical-decision-os-state.js';

type AnyRecord = Record<string, unknown>;

function replaceRefs(value: unknown, oldId: string, newId: string): unknown {
  if (typeof value === 'string') {
    return value
      .replaceAll(`.decision-os/cards/${oldId}/`, `.decision-os/cards/${newId}/`)
      .replaceAll(`/.decision-os/cards/${oldId}/`, `/.decision-os/cards/${newId}/`)
      .replaceAll(`.decision-os/threads/${oldId}/`, `.decision-os/threads/${newId}/`)
      .replaceAll(`/.decision-os/threads/${oldId}/`, `/.decision-os/threads/${newId}/`);
  }
  if (Array.isArray(value)) return value.map((entry) => replaceRefs(entry, oldId, newId));
  if (value && typeof value === 'object') {
    const next: AnyRecord = {};
    for (const [key, entry] of Object.entries(value as AnyRecord)) next[key] = replaceRefs(entry, oldId, newId);
    return next;
  }
  return value;
}

function uniqueRenameId(input: { desiredId: string; currentId: string; existingIds: Set<string>; decisionOsRoot: string }): string {
  let nextId = input.desiredId;
  let suffix = 2;
  while (nextId !== input.currentId && (input.existingIds.has(nextId) || existsSync(resolve(input.decisionOsRoot, `${nextId}.json`)))) {
    nextId = `${input.desiredId}-${suffix}`;
    suffix += 1;
  }
  return nextId;
}

export function renameLinkedLedger(input: {
  decisionOsRoot: string;
  cardId: string;
  title: string;
  overviewDocument: { cards?: AnyRecord[] };
}): { ok: boolean; ledgerId?: string; cardId?: string; error?: string } {
  const stateRead = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(input.decisionOsRoot, 'state.json'), writeBack: true } });
  const index = stateRead.ledgers.findIndex((entry) => entry.cardId === input.cardId || `ledger-card:${entry.id}` === input.cardId);
  if (index < 0) return { ok: false, error: 'Linked ledger not found.' };
  const current = stateRead.ledgers[index];
  const desiredId = ledgerSlug(input.title);
  const nextId = uniqueRenameId({
    desiredId,
    currentId: current.id,
    existingIds: new Set(stateRead.ledgers.map((entry) => entry.id)),
    decisionOsRoot: input.decisionOsRoot
  });
  const nextCardId = `ledger-card:${nextId}`;
  const oldLedgerPath = resolve(input.decisionOsRoot, current.ledgerFile.replace(/^\.decision-os\//, ''));
  const nextLedgerFile = `.decision-os/${nextId}.json`;
  const nextLedgerPath = resolve(input.decisionOsRoot, `${nextId}.json`);
  const oldCardsDir = resolve(input.decisionOsRoot, 'cards', current.id);
  const nextCardsDir = resolve(input.decisionOsRoot, 'cards', nextId);
  const oldThreadsDir = resolve(input.decisionOsRoot, 'threads', current.id);
  const nextThreadsDir = resolve(input.decisionOsRoot, 'threads', nextId);

  if (current.id !== nextId) {
    if (existsSync(oldLedgerPath)) {
      mkdirSync(dirname(nextLedgerPath), { recursive: true });
      renameSync(oldLedgerPath, nextLedgerPath);
    }
    if (existsSync(oldCardsDir)) {
      mkdirSync(dirname(nextCardsDir), { recursive: true });
      renameSync(oldCardsDir, nextCardsDir);
    }
    if (existsSync(oldThreadsDir)) {
      mkdirSync(dirname(nextThreadsDir), { recursive: true });
      renameSync(oldThreadsDir, nextThreadsDir);
    }
  }

  const ledgerPath = existsSync(nextLedgerPath) ? nextLedgerPath : oldLedgerPath;
  if (existsSync(ledgerPath)) {
    const ledger = replaceRefs(JSON.parse(readFileSync(ledgerPath, 'utf8')), current.id, nextId) as AnyRecord;
    ledger.modelName = nextId;
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  }

  const ledgers = stateRead.ledgers.slice();
  ledgers[index] = { id: nextId, title: input.title, ledgerFile: nextLedgerFile, cardId: nextCardId };
  writeCanonicalDecisionOsState({ file: stateRead.file, ledgers });

  const card = (input.overviewDocument.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
  if (card) {
    card.id = nextCardId;
    card.targetLedgerId = nextId;
    card.title = input.title;
    card.ledgerFile = nextLedgerFile;
  }
  return { ok: true, ledgerId: nextId, cardId: nextCardId };
}
