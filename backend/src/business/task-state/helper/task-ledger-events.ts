import { randomUUID } from 'node:crypto';
import { canonicalJson, createTaskFieldEvent } from './task-event-codec.js';
import type { TaskEntityType, TaskFieldChange, TaskFieldEvent } from './task-event-types.js';

type AnyRecord = Record<string, unknown>;
const collections = { card: 'cards', annotation: 'annotations', relationship: 'relationships' } as const;
const excludedLedgerFields = new Set(['cards', 'annotations', 'relationships', 'notes', 'deletedNoteIds']);
const excludedEntityFields = new Set(['id', 'description']);

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

function structuredValue(path: string[], value: unknown): unknown {
  if (path.at(-1) === 'comment') {
    const comment = record(value);
    return Object.fromEntries(Object.entries(comment).filter(([key]) => key !== 'what'));
  }
  return structuredClone(value);
}

function flatten(value: AnyRecord, excluded: Set<string>, prefix: string[] = []): Map<string, unknown> {
  const fields = new Map<string, unknown>();
  for (const [key, raw] of Object.entries(value)) {
    if (excluded.has(key)) continue;
    const path = [...prefix, key];
    const next = structuredValue(path, raw);
    if (next && typeof next === 'object' && !Array.isArray(next) && key !== 'comment') {
      for (const [nestedPath, nestedValue] of flatten(next as AnyRecord, new Set(), path)) fields.set(nestedPath, nestedValue);
    } else fields.set(path.join('/'), next);
  }
  return fields;
}

function changesBetween(before: AnyRecord | null, after: AnyRecord | null, excluded: Set<string>): TaskFieldChange[] {
  if (!after) return [{ path: '$entity', operation: 'tombstone' }];
  const left = before ? flatten(before, excluded) : new Map<string, unknown>();
  const right = flatten(after, excluded);
  const paths = new Set([...left.keys(), ...right.keys()]);
  return [...paths].sort().flatMap((path): TaskFieldChange[] => {
    if (!right.has(path)) return [{ path, operation: 'remove' }];
    if (!left.has(path) || canonicalJson(left.get(path)) !== canonicalJson(right.get(path))) return [{ path, operation: 'set', value: right.get(path) }];
    return [];
  });
}

export function taskLedgerEventsBetween(input: { projectId: string; writerId: string; emittedAt: string; before?: AnyRecord | null; after: AnyRecord }): TaskFieldEvent[] {
  const events: TaskFieldEvent[] = [];
  const add = (entityType: TaskEntityType, entityId: string, changes: TaskFieldChange[]): void => {
    if (changes.length === 0) return;
    events.push(createTaskFieldEvent({ eventId: randomUUID(), projectId: input.projectId, writerId: input.writerId, emittedAt: input.emittedAt, entityType, entityId, changes }));
  };
  add('ledger', 'tasks', changesBetween(input.before ?? null, input.after, excludedLedgerFields));
  for (const [entityType, collection] of Object.entries(collections) as Array<[Exclude<TaskEntityType, 'ledger'>, string]>) {
    const before = new Map(records(input.before?.[collection]).map((entity) => [String(entity.id ?? ''), entity]));
    const after = new Map(records(input.after[collection]).map((entity) => [String(entity.id ?? ''), entity]));
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      if (!id) continue;
      add(entityType, id, changesBetween(before.get(id) ?? null, after.get(id) ?? null, excludedEntityFields));
    }
  }
  return events;
}
