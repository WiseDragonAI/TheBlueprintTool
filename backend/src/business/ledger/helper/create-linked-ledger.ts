/**
 * WHAT: Creates a real ledger and its linked parent canvas card.
 * WHY: New ledgers should always be born from the same canonical ledgers registry and overview card contract.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeCanonicalDecisionOsState } from '../effect/write-canonical-decision-os-state.js';
import { ensureLedgersCanvasDocument } from './ensure-ledgers-canvas-document.js';
import { ledgerSlug } from './ledger-slug.js';
import { readCanonicalDecisionOsState } from './read-canonical-decision-os-state.js';

type AnyRecord = Record<string, unknown>;

function uniqueLedgerIdentity(input: { decisionOsRoot: string; title: string; existingIds: Set<string>; existingFiles: Set<string> }): { id: string; ledgerFile: string } {
  const baseId = ledgerSlug(input.title);
  let id = baseId;
  let ledgerFile = `${baseId}.json`;
  let suffix = 2;
  while (input.existingIds.has(id) || input.existingFiles.has(ledgerFile) || existsSync(resolve(input.decisionOsRoot, ledgerFile))) {
    id = `${baseId}-${suffix}`;
    ledgerFile = `${baseId}-${suffix}.json`;
    suffix += 1;
  }
  return { id, ledgerFile };
}

export function createLinkedLedger(input: {
  decisionOsRoot: string;
  title: string;
  rect?: { x?: number; y?: number; width?: number; height?: number };
}): { ok: true; tab: AnyRecord; ledger: AnyRecord; state: { ledgers: AnyRecord[] }; card: AnyRecord } {
  const title = input.title.trim() || 'New Ledger';
  const stateRead = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(input.decisionOsRoot, 'state.json'), writeBack: true } });
  const existingIds = new Set(stateRead.ledgers.map((entry) => entry.id));
  const existingFiles = new Set(stateRead.ledgers.map((entry) => entry.ledgerFile.replace(/^\.decision-os\//, '')));
  const identity = uniqueLedgerIdentity({ decisionOsRoot: input.decisionOsRoot, title, existingIds, existingFiles });
  const cardId = `ledger-card:${identity.id}`;
  const tab = { id: identity.id, title, ledgerFile: `.decision-os/${identity.ledgerFile}`, cardId };
  const ledger = {
    modelName: identity.id,
    diagramSize: { width: 5200, height: 2600 },
    viewport: { x: 0, y: 0, scale: 1 },
    cards: [],
    annotations: [],
    relationships: [],
    notes: {}
  };
  mkdirSync(input.decisionOsRoot, { recursive: true });
  writeFileSync(resolve(input.decisionOsRoot, identity.ledgerFile), JSON.stringify(ledger, null, 2));
  const ledgers = stateRead.ledgers.concat(tab);
  writeCanonicalDecisionOsState({ file: stateRead.file, ledgers });
  const overview = ensureLedgersCanvasDocument({ decisionOsRoot: input.decisionOsRoot });
  const card = overview.document.cards.find((entry) => String(entry.id ?? '') === cardId) as AnyRecord;
  if (input.rect && card) {
    card.x = Number(input.rect.x ?? card.x ?? 0);
    card.y = Number(input.rect.y ?? card.y ?? 0);
    card.w = Math.max(260, Number(input.rect.width ?? card.w ?? 360));
    card.h = Math.max(132, Number(input.rect.height ?? card.h ?? 180));
    writeFileSync(overview.path, JSON.stringify(overview.document, null, 2));
  }
  return { ok: true, tab, ledger, state: { ledgers }, card };
}
