/**
 * WHAT: Validates JSON task labels and relationship-owned master-task membership.
 * WHY: Agents need a deterministic gate whose result does not depend on Markdown projections.
 */
import { canonicalSubtaskRelationships, isMasterCard, labelsOf, record as isRecord } from './master-task-model.js';

type JsonObject = Record<string, unknown>;

export function validateMasterTasks(ledger: unknown, cardId?: string): { checked: number; errors: Array<{ cardId: string; diagnostics: string[] }> } {
  const allCards = isRecord(ledger) && Array.isArray(ledger.cards) ? ledger.cards.filter(isRecord) : [];
  const cards = allCards.filter((card) => !cardId || String(card.id ?? '') === cardId);
  const errors: Array<{ cardId: string; diagnostics: string[] }> = [];
  let checked = 0;

  for (const card of cards) {
    const outgoing = canonicalSubtaskRelationships(isRecord(ledger) ? ledger : {}, String(card.id ?? ''));
    if (!isMasterCard(card)) continue;
    checked += 1;

    const diagnostics: string[] = [];
    if (!['todo', 'backlog', 'done'].includes(String(card.status ?? 'todo'))) diagnostics.push('invalid master status');
    const canonicalMaster = labelsOf(card).includes('master-task');
    if (canonicalMaster && labelsOf(card).includes('subtask')) diagnostics.push('invalid_master_label');
    for (const relationship of outgoing) {
      const childId = String(relationship.to ?? '');
      const child = allCards.find((entry) => String(entry.id ?? '') === childId);
      if (!child) diagnostics.push(`missing_subtask:${childId}`);
      else if (labelsOf(child).includes('master-task')) diagnostics.push(`invalid_subtask_target:${childId}`);
      const position = Number(relationship.position);
      if (!Number.isInteger(position) || position < 0) diagnostics.push(`invalid_subtask_position:${String(relationship.id ?? '')}`);
    }
    if (diagnostics.length > 0) errors.push({ cardId: String(card.id ?? '(missing id)'), diagnostics });
  }

  return { checked, errors };
}

export function formatMasterTaskValidation(report: ReturnType<typeof validateMasterTasks>): string {
  if (report.errors.length === 0) return `Validated ${report.checked} master task${report.checked === 1 ? '' : 's'}.`;
  return report.errors.map((entry) => `${entry.cardId}: ${entry.diagnostics.join(', ')}`).join('\n');
}
