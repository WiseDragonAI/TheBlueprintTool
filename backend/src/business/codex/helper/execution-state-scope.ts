/**
 * WHAT: Resolves one card request to its canonical execution group and historical compatibility scope.
 * WHY: Task descendants share a master task while an ordinary canvas card owns its own execution history.
 */
import { resolveTaskLineage } from './task-execution-router.js';

type AnyRecord = Record<string, unknown>;

export type ExecutionStateScope = {
  ledgerId: string;
  requestedCardId: string;
  taskId: string;
  sourceCardId: string;
  includeLegacyUnscopedExecutions: boolean;
};

export function resolveExecutionStateScope(input: {
  taskLedger: AnyRecord;
  ledgerId: string;
  requestedCardId: string;
}): ExecutionStateScope {
  // WHAT: Give every ordinary card one independent execution scope.
  // WHY: Non-task ledgers have no master-subtask lineage and historical records used an empty task id.
  if (input.ledgerId !== 'tasks') {
    return {
      ledgerId: input.ledgerId,
      requestedCardId: input.requestedCardId,
      taskId: input.requestedCardId,
      sourceCardId: input.requestedCardId,
      includeLegacyUnscopedExecutions: true,
    };
  }

  const cards = Array.isArray(input.taskLedger.cards) ? input.taskLedger.cards : [];
  const isTaskCard = cards.some((card) => (
    card !== null
    && typeof card === 'object'
    && String((card as AnyRecord).id ?? '') === input.requestedCardId
  ));
  // WHAT: Preserve an optimistic empty scope for a task card not materialized locally yet.
  // WHY: Newly accepted tasks can be queried before their synchronized card projection arrives.
  if (!isTaskCard) {
    return {
      ledgerId: 'tasks',
      requestedCardId: input.requestedCardId,
      taskId: input.requestedCardId,
      sourceCardId: input.requestedCardId,
      includeLegacyUnscopedExecutions: false,
    };
  }

  return {
    ledgerId: 'tasks',
    requestedCardId: input.requestedCardId,
    taskId: resolveTaskLineage({
      ledger: input.taskLedger,
      sourceCardId: input.requestedCardId,
    }).taskId,
    sourceCardId: input.requestedCardId,
    includeLegacyUnscopedExecutions: false,
  };
}
