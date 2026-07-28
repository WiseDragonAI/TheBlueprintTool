/**
 * WHAT: Resolves the structural parent and append position for generated pipeline output cards.
 * WHY: Skill outputs must enter the existing task graph as positioned siblings without creating nested task chains.
 */
import { TaskExecutionAdmissionError, resolveTaskLineage } from './task-execution-router.js';

type AnyRecord = Record<string, unknown>;

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is AnyRecord => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    : [];
}

export function resolvePipelineOutputParent(input: {
  ledgerId: string;
  ledger: AnyRecord;
  sourceCardId: string;
}): { outputParentCardId: string; firstOutputSubtaskPosition: number } {
  const cards = records(input.ledger.cards);
  const outputParentCardId = input.ledgerId === 'tasks'
    ? resolveTaskLineage({ ledger: input.ledger, sourceCardId: input.sourceCardId }).taskId
    : input.sourceCardId;
  const parent = cards.find((card) => String(card.id ?? '') === outputParentCardId);
  if (!parent) throw new TaskExecutionAdmissionError('pipeline_output_parent_not_found', 404, { cardId: outputParentCardId });
  if (input.ledgerId === 'tasks') {
    const labels = Array.isArray(parent.labels) ? parent.labels.map(String) : [];
    if (!labels.includes('master-task')) {
      throw new TaskExecutionAdmissionError('task_master_label_missing', 409, { taskId: outputParentCardId });
    }
  }
  const positions = records(input.ledger.relationships)
    .filter((relationship) => (
      String(relationship.from ?? '') === outputParentCardId
      && String(relationship.label ?? '') === 'subtask'
    ))
    .map((relationship) => Number(relationship.position))
    .filter((position) => Number.isSafeInteger(position) && position >= 0);
  return {
    outputParentCardId,
    firstOutputSubtaskPosition: positions.length === 0 ? 0 : Math.max(...positions) + 1,
  };
}
