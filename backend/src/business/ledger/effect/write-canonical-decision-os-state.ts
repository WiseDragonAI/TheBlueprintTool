/**
 * WHAT: Writes the canonical decision-os ledgers registry.
 * WHY: State writes must not reintroduce the legacy tabs property after migration.
 */
import { replaceTextFileAtomically } from '../helper/card-content-file.js';
import type { DecisionOsLedgerEntry } from '../helper/normalize-decision-os-state.js';

export function writeCanonicalDecisionOsState(input: { file: string; ledgers: DecisionOsLedgerEntry[] }): void {
  replaceTextFileAtomically(input.file, JSON.stringify({ ledgers: input.ledgers }, null, 2));
}
