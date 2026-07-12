/**
 * WHAT: Validates the Markdown lifecycle contract for every master-task card.
 * WHY: Agents need a deterministic pre-finish check that prevents stale task cards.
 */
type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const statusLabels = ['task-waiting', 'task-active', 'task-complete'];

export function validateMasterTasks(ledger: unknown): { checked: number; errors: Array<{ cardId: string; diagnostics: string[] }> } {
  const cards = isRecord(ledger) && Array.isArray(ledger.cards) ? ledger.cards.filter(isRecord) : [];
  const errors: Array<{ cardId: string; diagnostics: string[] }> = [];
  let checked = 0;

  for (const card of cards) {
    const comment = isRecord(card.comment) ? card.comment : {};
    const markdown = String(comment.what ?? '').replace(/\r\n?/g, '\n');
    const labelLines = markdown.split('\n').filter((line) => /^\s*(?:#[a-z][a-z0-9-]*\s*)+$/i.test(line));
    const labels = new Set(Array.from(labelLines.join('\n').matchAll(/#([a-z][a-z0-9-]*)\b/gi), (match) => match[1].toLowerCase()));
    if (!labels.has('master-task')) continue;
    checked += 1;

    const diagnostics: string[] = [];
    const statuses = statusLabels.filter((status) => labels.has(status));
    const ledgerName = markdown.match(/^\s*(?:\*\*)?Ledger(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim();
    const waiting = markdown.match(/^\s*(?:\*\*)?Waiting since(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim();
    const active = markdown.match(/^\s*(?:\*\*)?Active since(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim();
    if (statuses.length !== 1) diagnostics.push('expected exactly one task status label');
    if (!ledgerName) diagnostics.push('missing Ledger');
    if (!waiting || !Number.isFinite(Date.parse(waiting))) diagnostics.push('invalid Waiting since');
    if (statuses[0] === 'task-active' && (!active || !Number.isFinite(Date.parse(active)))) diagnostics.push('invalid Active since');
    if (diagnostics.length > 0) errors.push({ cardId: String(card.id ?? '(missing id)'), diagnostics });
  }

  return { checked, errors };
}

export function formatMasterTaskValidation(report: ReturnType<typeof validateMasterTasks>): string {
  if (report.errors.length === 0) return `Validated ${report.checked} master task${report.checked === 1 ? '' : 's'}.`;
  return report.errors.map((entry) => `${entry.cardId}: ${entry.diagnostics.join(', ')}`).join('\n');
}
