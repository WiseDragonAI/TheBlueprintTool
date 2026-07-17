/**
 * WHAT: Clears terminal execution ownership while preserving the resumable run identity.
 * WHY: A settled run must leave Exec, and an older callback must never clear a newer execution.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';

type AnyRecord = Record<string, unknown>;

export function clearCardCodexExecution(input: { ledgerPath: string; cardId: string; runId: string }): boolean {
  try {
    const ledger = JSON.parse(readFileSync(input.ledgerPath, 'utf8')) as AnyRecord & { cards?: AnyRecord[] };
    const card = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
    if (!card || String(card.codexActiveRunId ?? '') !== input.runId) return false;
    delete card.codexActiveRunId;
    if (String(card.executionRunId ?? '') === input.runId) {
      delete card.executionStatus;
      delete card.executionRunId;
    }
    writeFileSync(input.ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
    return true;
  } catch {
    // The run is still settled in memory when its project was removed during shutdown.
    return false;
  }
}

export function clearCardCodexExecutionForLedger(input: {
  decisionOsRoot: string;
  ledgerId: string;
  cardId: string;
  runId: string;
  runtime?: AnyRecord;
}): boolean {
  const state = readCanonicalDecisionOsState({
    action_payload: { decisionOsFile: resolve(input.decisionOsRoot, 'state.json') },
    runtime_state: input.runtime ?? {},
  });
  const ledgerFile = String(state.ledgers.find((entry) => entry.id === input.ledgerId)?.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(input.decisionOsRoot, ledgerFile);
  const inner = relative(input.decisionOsRoot, ledgerPath);
  if (!ledgerFile || !inner || inner.startsWith('..') || isAbsolute(inner)) return false;
  return clearCardCodexExecution({ ledgerPath, cardId: input.cardId, runId: input.runId });
}
