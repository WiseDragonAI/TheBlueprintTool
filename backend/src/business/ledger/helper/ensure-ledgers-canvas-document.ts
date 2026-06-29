/**
 * WHAT: Ensures the hidden ledgers canvas mirrors the canonical ledgers registry.
 * WHY: Existing workspaces need automatic migration from legacy tabs into linked ledger cards.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeCanonicalDecisionOsState } from '../effect/write-canonical-decision-os-state.js';
import { readCanonicalDecisionOsState } from './read-canonical-decision-os-state.js';
import type { DecisionOsLedgerEntry } from './normalize-decision-os-state.js';

type AnyRecord = Record<string, unknown>;

const defaultCardWidth = 360;
const defaultCardHeight = 180;

function defaultLedgerCard(entry: DecisionOsLedgerEntry, index: number): AnyRecord {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    id: entry.cardId || `ledger-card:${entry.id}`,
    targetLedgerId: entry.id,
    cardType: 'ledger',
    domainId: 'ledgers',
    title: entry.title,
    ledgerFile: entry.ledgerFile,
    status: 'todo',
    x: column * 460,
    y: row * 280,
    w: defaultCardWidth,
    h: defaultCardHeight,
    comment: { what: `Ledger: ${entry.title}` }
  };
}

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function ensureLedgersCanvasDocument(input: { decisionOsRoot: string }): {
  path: string;
  document: AnyRecord & { cards: AnyRecord[]; annotations: AnyRecord[]; relationships: AnyRecord[] };
  ledgers: DecisionOsLedgerEntry[];
} {
  const stateRead = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(input.decisionOsRoot, 'state.json'), writeBack: true } });
  const path = resolve(input.decisionOsRoot, 'ledgers-canvas.json');
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const document = isRecord(existing) ? existing : {};
  document.modelName = 'ledgers-canvas';
  document.diagramSize = isRecord(document.diagramSize) ? document.diagramSize : { width: 5200, height: 2600 };
  document.viewport = isRecord(document.viewport) ? document.viewport : { x: 0, y: 0, scale: 0.42 };
  const cards = Array.isArray(document.cards) ? document.cards as AnyRecord[] : [];
  const annotations = Array.isArray(document.annotations) ? document.annotations as AnyRecord[] : [];
  const relationships = Array.isArray(document.relationships) ? document.relationships as AnyRecord[] : [];
  const notes = isRecord(document.notes) ? document.notes : {};

  let stateChanged = stateRead.migrated;
  const ledgers = stateRead.ledgers.map((entry) => {
    if (entry.cardId) return entry;
    stateChanged = true;
    return { ...entry, cardId: `ledger-card:${entry.id}` };
  });

  const currentLedgerIds = new Set(ledgers.map((entry) => entry.id));
  const nextCards = cards.filter((card) => {
    const targetLedgerId = String(card.targetLedgerId ?? '');
    return !targetLedgerId || currentLedgerIds.has(targetLedgerId);
  });
  for (const [index, entry] of ledgers.entries()) {
    const cardId = entry.cardId || `ledger-card:${entry.id}`;
    let card = nextCards.find((candidate) => String(candidate.id ?? '') === cardId)
      ?? nextCards.find((candidate) => String(candidate.targetLedgerId ?? '') === entry.id);
    if (!card) {
      card = defaultLedgerCard({ ...entry, cardId }, index);
      nextCards.push(card);
    }
    card.id = cardId;
    card.targetLedgerId = entry.id;
    card.cardType = 'ledger';
    card.domainId = 'ledgers';
    card.title = entry.title;
    card.ledgerFile = entry.ledgerFile;
    card.w = Math.max(220, Number(card.w ?? defaultCardWidth));
    card.h = Math.max(132, Number(card.h ?? defaultCardHeight));
  }

  document.cards = nextCards;
  document.annotations = annotations;
  document.relationships = relationships;
  document.notes = notes;
  mkdirSync(input.decisionOsRoot, { recursive: true });
  writeFileSync(path, JSON.stringify(document, null, 2));
  if (stateChanged || JSON.stringify(ledgers) !== JSON.stringify(stateRead.ledgers)) {
    writeCanonicalDecisionOsState({ file: stateRead.file, ledgers });
  }
  return { path, document: document as AnyRecord & { cards: AnyRecord[]; annotations: AnyRecord[]; relationships: AnyRecord[] }, ledgers };
}
