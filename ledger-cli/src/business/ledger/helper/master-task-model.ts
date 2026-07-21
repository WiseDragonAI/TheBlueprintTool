type JsonObject = Record<string, unknown>;

export function record(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function labelsOf(card: JsonObject): string[] {
  return Array.isArray(card.labels) ? card.labels.map(String).map((label) => label.trim()).filter(Boolean) : [];
}

export function isMasterCard(card: JsonObject): boolean {
  return labelsOf(card).includes('master-task');
}

export function withCanonicalTaskLabel(card: JsonObject): JsonObject {
  return { ...card, labels: [...new Set(labelsOf(card).filter((value) => value !== 'master-task' && value !== 'subtask').concat('master-task'))] };
}

export function canonicalSubtaskRelationships(ledger: JsonObject, masterCardId: string): JsonObject[] {
  return Array.isArray(ledger.relationships)
    ? ledger.relationships.filter(record)
      .filter((relationship) => String(relationship.from ?? '') === masterCardId && String(relationship.label ?? '') === 'subtask')
      .sort((left, right) => Number(left.position) - Number(right.position) || String(left.id ?? '').localeCompare(String(right.id ?? '')))
    : [];
}

export function stripLegacyTaskProjection(markdown: string): string {
  const sourceLines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const lines: string[] = [];
  let skippingSubtasks = false;
  for (const sourceLine of sourceLines) {
    if (/^##\s+(?:[A-Z]\.\s+)?Subtasks\s*$/i.test(sourceLine)) {
      skippingSubtasks = true;
      while (lines.at(-1) === '' || lines.at(-1) === '---') lines.pop();
      continue;
    }
    if (skippingSubtasks && /^##\s+/.test(sourceLine)) skippingSubtasks = false;
    if (skippingSubtasks) continue;
    if (/^(?:Ledger|Waiting since|Active since|Completed at):\s*/i.test(sourceLine)) continue;
    if (!/^\s*(?:#[a-z][a-z0-9-]*\s*)+$/i.test(sourceLine)) {
      lines.push(sourceLine);
      continue;
    }
    lines.push(sourceLine.replace(/(?:^|\s+)#(?:master-task|task-(?:waiting|active|complete))\b/gi, '').replace(/\s+/g, ' ').trim());
  }
  return lines.join('\n')
    .replace(/(\(card:[^)]+\))\s+[—-]\s+Status:\s*[^\n]+/gi, '$1')
    .replace(/^\n+/, '')
    .replace(/\n{3,}/g, '\n\n');
}
