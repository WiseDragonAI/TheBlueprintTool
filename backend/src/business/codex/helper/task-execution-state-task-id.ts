/**
 * WHAT: Resolves the canonical task owner for an execution-state read.
 * WHY: Ordinary ledger cards expose an empty Codex Log without participating in task lineage.
 */
import { resolveTaskLineage } from './task-execution-router.js';

type AnyRecord = Record<string, unknown>;

export function taskExecutionStateTaskId(
  ledger: AnyRecord,
  requestedCardId: string,
): string {
  const cards = Array.isArray(ledger.cards) ? ledger.cards : [];
  const isTaskCard = cards.some((card) => (
    card !== null
    && typeof card === 'object'
    && String((card as AnyRecord).id ?? '') === requestedCardId
  ));
  return isTaskCard
    ? resolveTaskLineage({ ledger, sourceCardId: requestedCardId }).taskId
    : requestedCardId;
}
