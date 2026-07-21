/**
 * WHAT: Clears terminal execution ownership while preserving the resumable run identity.
 * WHY: A settled run must leave Exec, and an older callback must never clear a newer execution.
 */
import { readFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { persistLedgerProjection } from '@backend/business/task-state/helper/persist-ledger-projection.js';
import { readLedgerProjection } from '@backend/business/task-state/helper/read-ledger-projection.js';

type AnyRecord = Record<string, unknown>;

export async function clearCardCodexExecution(input: {
  ledgerPath: string;
  cardId: string;
  runId: string;
  executionId: string;
  decisionOsRoot?: string;
  ledgerId?: string;
  runtime?: AnyRecord;
  terminalState?: 'terminal' | 'failed';
}): Promise<boolean> {
  try {
    const ledgerId = input.ledgerId ?? (basename(input.ledgerPath) === 'tasks.json' ? 'tasks' : '');
    const ledger = readLedgerProjection({ ledgerId, ledgerPath: input.ledgerPath, runtime: input.runtime }) as AnyRecord & { cards?: AnyRecord[] };
    const card = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
    if (!card || String(card.codexActiveRunId ?? '') !== input.runId) return false;
    const persistedExecutionId = String(card.codexActiveExecutionId ?? '');
    if (!persistedExecutionId || persistedExecutionId !== input.executionId) return false;
    delete card.codexActiveRunId;
    delete card.codexActiveExecutionId;
    if (String(card.executionRunId ?? '') === input.runId) {
      delete card.executionStatus;
      delete card.executionRunId;
    }
    if (card.executionIntent && typeof card.executionIntent === 'object' && ['waiting', 'queued', 'running'].includes(String((card.executionIntent as AnyRecord).state ?? ''))) {
      card.executionIntent = { ...(card.executionIntent as AnyRecord), state: input.terminalState ?? 'terminal', updatedAt: new Date().toISOString() };
    }
    await persistLedgerProjection({
      decisionOsRoot: input.decisionOsRoot,
      ledgerId: input.ledgerId,
      ledgerPath: input.ledgerPath,
      ledger,
      runtime: input.runtime,
      command: { kind: 'clear-codex-execution', cardIds: [input.cardId] },
    });
    return true;
  } catch {
    // The run is still settled in memory when its project was removed during shutdown.
    return false;
  }
}

export async function clearCardCodexExecutionForLedger(input: {
  decisionOsRoot: string;
  ledgerId: string;
  cardId: string;
  runId: string;
  executionId: string;
  runtime?: AnyRecord;
}): Promise<boolean> {
  const state = readCanonicalDecisionOsState({
    action_payload: { decisionOsFile: resolve(input.decisionOsRoot, 'state.json') },
    runtime_state: input.runtime ?? {},
  });
  const ledgerFile = String(state.ledgers.find((entry) => entry.id === input.ledgerId)?.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(input.decisionOsRoot, ledgerFile);
  const inner = relative(input.decisionOsRoot, ledgerPath);
  if (!ledgerFile || !inner || inner.startsWith('..') || isAbsolute(inner)) return false;
  return clearCardCodexExecution({
    decisionOsRoot: input.decisionOsRoot,
    ledgerId: input.ledgerId,
    ledgerPath,
    cardId: input.cardId,
    runId: input.runId,
    executionId: input.executionId,
    runtime: input.runtime,
  });
}
