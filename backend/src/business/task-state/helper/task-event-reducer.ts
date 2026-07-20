import { canonicalJson } from './task-event-codec.js';
import { taskEventReducerVersion, type TaskFieldChange, type TaskFieldEvent, type TaskProjection, type TaskProjectionConflict } from './task-event-types.js';

type AnyRecord = Record<string, unknown>;

const entityCollection = {
  card: 'cards',
  annotation: 'annotations',
  relationship: 'relationships',
} as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

function entityFor(projection: TaskProjection, event: TaskFieldEvent): AnyRecord {
  if (event.entityType === 'ledger') return projection.ledger;
  const collectionName = entityCollection[event.entityType];
  const collection = records(projection.ledger[collectionName]);
  projection.ledger[collectionName] = collection;
  let entity = collection.find((candidate) => String(candidate.id ?? '') === event.entityId);
  if (!entity) {
    entity = { id: event.entityId };
    collection.push(entity);
  }
  return entity;
}

function parentFor(target: AnyRecord, path: string, create: boolean): { parent: AnyRecord; key: string } | null {
  const parts = path.split('/');
  const key = parts.pop()!;
  let parent = target;
  for (const part of parts) {
    const current = parent[part];
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      if (!create) return null;
      parent[part] = {};
    }
    parent = parent[part] as AnyRecord;
  }
  return { parent, key };
}

function applyChange(target: AnyRecord, change: TaskFieldChange): void {
  const location = parentFor(target, change.path, change.operation === 'set' || change.operation === 'add');
  if (!location) return;
  if (change.operation === 'set') location.parent[location.key] = clone(change.value);
  if (change.operation === 'remove' || change.operation === 'tombstone') delete location.parent[location.key];
  if (change.operation === 'add') {
    const values = Array.isArray(location.parent[location.key]) ? location.parent[location.key] as unknown[] : [];
    if (!values.some((value) => canonicalJson(value) === canonicalJson(change.value))) values.push(clone(change.value));
    location.parent[location.key] = values;
  }
}

function removeEntity(projection: TaskProjection, event: TaskFieldEvent): void {
  if (event.entityType === 'ledger') return;
  const collectionName = entityCollection[event.entityType];
  projection.ledger[collectionName] = records(projection.ledger[collectionName]).filter((entity) => String(entity.id ?? '') !== event.entityId);
}

function changeKey(event: TaskFieldEvent, change: TaskFieldChange): string {
  return `${event.entityType}\u0000${event.entityId}\u0000${change.path}`;
}

function effectKey(change: TaskFieldChange): string {
  return `${change.operation}\u0000${canonicalJson(change.value)}`;
}

export function emptyTaskProjection(projectId: string, ledger: AnyRecord = {}): TaskProjection {
  const materialized = clone(ledger);
  materialized.cards = records(materialized.cards);
  materialized.annotations = records(materialized.annotations);
  materialized.relationships = records(materialized.relationships);
  return { version: 1, reducerVersion: taskEventReducerVersion, projectId, ledger: materialized, conflicts: [], appliedEventIds: [], lastRevision: 0, fieldRevisions: {} };
}

function eventPosition(event: TaskFieldEvent, legacyPositions: Map<string, number>): number {
  if (event.revision !== undefined) return event.revision;
  return legacyPositions.get(event.emittedAt) ?? 0;
}

/** Reduces causal positions. `emittedAt` is used only to import legacy events that predate revisions. */
export function reduceTaskEvents(input: { projectId: string; events: TaskFieldEvent[]; base?: TaskProjection }): TaskProjection {
  const projection = input.base ? clone(input.base) : emptyTaskProjection(input.projectId);
  projection.reducerVersion = taskEventReducerVersion;
  projection.lastRevision ??= 0;
  projection.fieldRevisions ??= {};
  const seen = new Set(projection.appliedEventIds);
  const events = input.events.filter((event) => event.projectId === input.projectId && !seen.has(event.eventId));
  const legacyDates = [...new Set(events.filter((event) => event.revision === undefined).map((event) => event.emittedAt))].sort();
  const legacyBase = projection.lastRevision;
  const legacyPositions = new Map(legacyDates.map((date, index) => [date, legacyBase + index + 1]));
  const positions = new Map<number, TaskFieldEvent[]>();
  for (const event of events) {
    const position = eventPosition(event, legacyPositions);
    (positions.get(position) ?? (positions.set(position, []), positions.get(position)!)).push(event);
  }
  for (const position of [...positions.keys()].sort((left, right) => left - right)) {
    const positionEvents = positions.get(position)!;
    const fields = new Map<string, Array<{ event: TaskFieldEvent; change: TaskFieldChange }>>();
    for (const event of positionEvents) {
      for (const change of event.changes) {
        const key = changeKey(event, change);
        (fields.get(key) ?? (fields.set(key, []), fields.get(key)!)).push({ event, change });
      }
    }
    for (const [fieldKey, changes] of fields) {
      if ((projection.fieldRevisions[fieldKey] ?? 0) > position) continue;
      const uniqueEffects = new Map<string, { event: TaskFieldEvent; change: TaskFieldChange }>();
      for (const entry of changes) uniqueEffects.set(effectKey(entry.change), entry);
      const first = changes[0];
      projection.conflicts = projection.conflicts.filter((conflict) => !(conflict.entityType === first.event.entityType && conflict.entityId === first.event.entityId && conflict.path === first.change.path));
      if (uniqueEffects.size === 1) {
        if (first.change.path === '$entity' && first.change.operation === 'tombstone') removeEntity(projection, first.event);
        else applyChange(entityFor(projection, first.event), first.change);
      } else {
        const conflict: TaskProjectionConflict = {
          emittedAt: first.event.emittedAt,
          entityType: first.event.entityType,
          entityId: first.event.entityId,
          path: first.change.path,
          candidates: changes.map(({ event, change }) => ({ eventId: event.eventId, writerId: event.writerId, operation: change.operation, ...(Object.hasOwn(change, 'value') ? { value: clone(change.value) } : {}) })),
        };
        projection.conflicts.push(conflict);
      }
      projection.fieldRevisions[fieldKey] = position;
    }
    for (const event of positionEvents) seen.add(event.eventId);
    projection.lastRevision = Math.max(projection.lastRevision, position);
  }
  projection.appliedEventIds = [...seen];
  projection.ledger.cards = records(projection.ledger.cards);
  projection.ledger.annotations = records(projection.ledger.annotations);
  projection.ledger.relationships = records(projection.ledger.relationships);
  projection.conflicts.sort((left, right) => `${left.entityType}\u0000${left.entityId}\u0000${left.path}`.localeCompare(`${right.entityType}\u0000${right.entityId}\u0000${right.path}`));
  return projection;
}
