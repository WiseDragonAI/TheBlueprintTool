type JsonObject = Record<string, unknown>;

export function record(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function labelsOf(card: JsonObject): string[] {
  return Array.isArray(card.labels) ? card.labels.map(String).map((label) => label.trim()).filter(Boolean) : [];
}

export function hasTaskLabel(card: JsonObject): boolean {
  return labelsOf(card).some((label) => label === 'master-task' || label === 'subtask');
}

export function legacyMaster(markdown: string): boolean {
  return /^\s*(?:#[a-z][a-z0-9-]*\s*)*#master-task\b/im.test(markdown);
}

export function isMasterCard(card: JsonObject, markdown = ''): boolean {
  const labels = labelsOf(card);
  return labels.includes('master-task') || (!hasTaskLabel(card) && legacyMaster(markdown));
}

export function withCanonicalTaskLabel(card: JsonObject, label: 'master-task' | 'subtask'): JsonObject {
  return { ...card, labels: [...new Set(labelsOf(card).filter((value) => value !== 'master-task' && value !== 'subtask').concat(label))] };
}

export function canonicalSubtaskRelationships(ledger: JsonObject, masterCardId: string): JsonObject[] {
  return Array.isArray(ledger.relationships)
    ? ledger.relationships.filter(record).filter((relationship) => String(relationship.from ?? '') === masterCardId && String(relationship.label ?? '') === 'subtask')
    : [];
}

export function stripLegacyTaskProjection(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n').map((line) => {
    if (!/^\s*(?:#[a-z][a-z0-9-]*\s*)+$/i.test(line)) return line;
    return line.replace(/(?:^|\s+)#(?:master-task|task-(?:waiting|active|complete))\b/gi, '').replace(/\s+/g, ' ').trim();
  });
  return lines.join('\n')
    .replace(/(\(card:[^)]+\))\s+[—-]\s+Status:\s*[^\n]+/gi, '$1')
    .replace(/^\n+/, '')
    .replace(/\n{3,}/g, '\n\n');
}
