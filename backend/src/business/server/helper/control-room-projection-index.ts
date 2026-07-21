/**
 * WHAT: Owns identity indexes and generation-cached aggregate reads for Control Room task projection.
 * WHY: Scoped task changes must not search or rebuild complete task collections.
 */
type AnyRecord = Record<string, unknown>;

export type TaskLedgerIndex = {
  cards: Map<string, AnyRecord>;
  relationships: Map<string, AnyRecord>;
  relationshipsByMaster: Map<string, AnyRecord[]>;
  mastersByChild: Map<string, Set<string>>;
};

export type AggregateTaskIndex = {
  tasks: Map<string, AnyRecord>;
  generation: number;
  caches: Map<string, { generation: number; tasks: AnyRecord[] }>;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

export function taskKey(task: AnyRecord): string {
  return `${text(task.projectId)}\u0000${text(task.cardId)}`;
}

export function addRelationshipToIndex(index: TaskLedgerIndex, relationship: AnyRecord): void {
  if (text(relationship.label) !== 'subtask') return;
  const masterId = text(relationship.from);
  const childId = text(relationship.to);
  index.relationshipsByMaster.set(masterId, [...(index.relationshipsByMaster.get(masterId) ?? []), relationship].sort((left, right) => Number(left.position) - Number(right.position) || text(left.id).localeCompare(text(right.id))));
  const masters = index.mastersByChild.get(childId) ?? new Set<string>();
  masters.add(masterId);
  index.mastersByChild.set(childId, masters);
}

export function removeRelationshipFromIndex(index: TaskLedgerIndex, relationship: AnyRecord): void {
  if (text(relationship.label) !== 'subtask') return;
  const masterId = text(relationship.from);
  const childId = text(relationship.to);
  const retained = (index.relationshipsByMaster.get(masterId) ?? []).filter((entry) => text(entry.id) !== text(relationship.id));
  if (retained.length > 0) index.relationshipsByMaster.set(masterId, retained);
  else index.relationshipsByMaster.delete(masterId);
  const masters = index.mastersByChild.get(childId);
  masters?.delete(masterId);
  if (masters?.size === 0) index.mastersByChild.delete(childId);
}

export function indexTaskLedger(ledger: AnyRecord): TaskLedgerIndex {
  const cards = new Map(records(ledger.cards).map((card) => [text(card.id), card]));
  const relationships = new Map(records(ledger.relationships).map((relationship) => [text(relationship.id), relationship]));
  const index: TaskLedgerIndex = { cards, relationships, relationshipsByMaster: new Map(), mastersByChild: new Map() };
  for (const relationship of relationships.values()) addRelationshipToIndex(index, relationship);
  return index;
}

export function createAggregateTaskIndex(tasks: AnyRecord[]): AggregateTaskIndex {
  return { tasks: new Map(tasks.map((task) => [taskKey(task), task])), generation: 0, caches: new Map() };
}

export function cachedAggregateTasks(index: AggregateTaskIndex, name: string, predicate?: (task: AnyRecord) => boolean, compare?: (left: AnyRecord, right: AnyRecord) => number): AnyRecord[] {
  const cached = index.caches.get(name);
  if (cached?.generation === index.generation) return cached.tasks;
  const tasks = [...index.tasks.values()].filter(predicate ?? (() => true));
  if (compare) tasks.sort(compare);
  index.caches.set(name, { generation: index.generation, tasks });
  return tasks;
}
