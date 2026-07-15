/**
 * WHAT: Migrates the legacy persisted card status `delayed` to `backlog` in every declared ledger.
 * WHY: Backlog is the canonical workflow vocabulary across storage, API, desktop, and mobile surfaces.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type AnyRecord = Record<string, unknown>;

export function migrateBacklogStatus(decisionOsRoot: string): { ledgersChanged: number; cardsChanged: number } {
  const marker = resolve(decisionOsRoot, 'migrations', 'backlog-status-v1.json');
  if (existsSync(marker)) return { ledgersChanged: 0, cardsChanged: 0 };
  const state = (() => {
    try {
      return JSON.parse(readFileSync(resolve(decisionOsRoot, 'state.json'), 'utf8')) as AnyRecord;
    } catch {
      return {};
    }
  })();
  const entries = Array.isArray(state.ledgers) ? state.ledgers : Array.isArray(state.tabs) ? state.tabs : [];
  let ledgersChanged = 0;
  let cardsChanged = 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const ledgerFile = String((entry as AnyRecord).ledgerFile ?? '').replace(/^\.decision-os\//, '');
    if (!ledgerFile) continue;
    const ledgerPath = resolve(decisionOsRoot, ledgerFile);
    if (!existsSync(ledgerPath)) continue;
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord;
    const cards = Array.isArray(ledger.cards) ? ledger.cards as AnyRecord[] : [];
    let changed = false;
    for (const card of cards) {
      if (card.status !== 'delayed') continue;
      card.status = 'backlog';
      cardsChanged += 1;
      changed = true;
    }
    if (!changed) continue;
    const temporary = `${ledgerPath}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`);
    renameSync(temporary, ledgerPath);
    ledgersChanged += 1;
  }
  mkdirSync(resolve(decisionOsRoot, 'migrations'), { recursive: true });
  const temporaryMarker = `${marker}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporaryMarker, `${JSON.stringify({ version: 1, completedAt: new Date().toISOString(), ledgersChanged, cardsChanged }, null, 2)}\n`);
  renameSync(temporaryMarker, marker);
  return { ledgersChanged, cardsChanged };
}
