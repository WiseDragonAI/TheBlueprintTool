/**
 * WHAT: Resolves project-owned accent identity for master tasks and their canonical linked subtasks.
 * WHY: Task-family color follows project ownership instead of incidental canvas-zone geometry.
 */
type AnyRecord = Record<string, unknown>;

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry) && typeof entry === 'object') : [];
}

function labels(card: AnyRecord): string[] {
  const values = Array.isArray(card.labels) ? card.labels : Array.isArray(card.tags) ? card.tags : [];
  return values.map(String);
}

export function taskFamilyCardIds(ledger: AnyRecord | null | undefined): Set<string> {
  const cards = records(ledger?.cards);
  const masterIds = new Set(cards.filter((card) => labels(card).includes('master-task')).map((card) => String(card.id ?? '')).filter(Boolean));
  const taskIds = new Set(masterIds);
  for (const relationship of records(ledger?.relationships)) {
    if (relationship.label !== 'subtask' || !masterIds.has(String(relationship.from ?? ''))) continue;
    const childId = String(relationship.to ?? '');
    if (childId) taskIds.add(childId);
  }
  return taskIds;
}

export function taskFamilyCardAccent(input: {
  ledger: AnyRecord | null | undefined;
  cardId: string;
  projectColor: string;
  taskIds?: ReadonlySet<string>;
}): string {
  const projectColor = input.projectColor.trim();
  if (!projectColor || !(input.taskIds ?? taskFamilyCardIds(input.ledger)).has(input.cardId)) return '';
  return projectColor;
}
