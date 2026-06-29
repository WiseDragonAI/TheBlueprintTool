/**
 * WHAT: Writes the canonical decision-os ledgers registry.
 * WHY: State writes must not reintroduce the legacy tabs property after migration.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DecisionOsLedgerEntry } from '../helper/normalize-decision-os-state.js';

export function writeCanonicalDecisionOsState(input: { file: string; ledgers: DecisionOsLedgerEntry[] }): void {
  mkdirSync(dirname(input.file), { recursive: true });
  writeFileSync(input.file, JSON.stringify({ ledgers: input.ledgers }, null, 2));
}
