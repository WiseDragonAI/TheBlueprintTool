/**
 * WHAT: Materializes one causal entity into the application ledger projection.
 * WHY: A changed card must update only its projection lane instead of rebuilding the workspace.
 */
import { canonicalJson } from './task-current-state-codec.js';
import { dotKey } from './task-current-state-join.js';
import type { TaskCurrentEntity, TaskCurrentProjection, TaskFieldOperation, TaskProjectionConflict, TaskRegisterCandidate } from './task-current-state-types.js';

type AnyRecord = Record<string, unknown>;

const collectionByType = {
  card: 'cards',
  annotation: 'annotations',
  relationship: 'relationships',
} as const;

type CollectionType = keyof typeof collectionByType;
type IndexedCollection = { values: Map<string, AnyRecord>; generation: number; cachedGeneration: number; cached: AnyRecord[] };
type ProjectionIndex = {
  collections: Record<CollectionType, IndexedCollection>;
  conflicts: Map<string, TaskProjectionConflict[]>;
  conflictGeneration: number;
  cachedConflictGeneration: number;
  cachedConflicts: TaskProjectionConflict[];
};

const projectionIndexes = new WeakMap<TaskCurrentProjection, ProjectionIndex>();

function compareCollection(type: CollectionType, left: AnyRecord, right: AnyRecord): number {
  return (type === 'relationship'
    ? Number(left.position ?? Number.MAX_SAFE_INTEGER) - Number(right.position ?? Number.MAX_SAFE_INTEGER)
    : 0
  ) || String(left.id ?? '').localeCompare(String(right.id ?? ''));
}

function indexFor(projection: TaskCurrentProjection): ProjectionIndex {
  const existing = projectionIndexes.get(projection);
  if (existing) return existing;
  const collections = Object.fromEntries(Object.entries(collectionByType).map(([rawType, name]) => {
    const type = rawType as CollectionType;
    const values = new Map<string, AnyRecord>();
    const current = Array.isArray(projection.ledger[name]) ? projection.ledger[name] as AnyRecord[] : [];
    for (const entry of current) values.set(String(entry.id ?? ''), entry);
    const state: IndexedCollection = { values, generation: 0, cachedGeneration: -1, cached: [] };
    Object.defineProperty(projection.ledger, name, {
      configurable: true,
      enumerable: true,
      get: () => {
        if (state.cachedGeneration !== state.generation) {
          state.cached = [...state.values.values()].sort((left, right) => compareCollection(type, left, right));
          state.cachedGeneration = state.generation;
        }
        return state.cached;
      },
    });
    return [type, state];
  })) as ProjectionIndex['collections'];
  const conflicts = new Map<string, TaskProjectionConflict[]>();
  for (const conflict of projection.conflicts) {
    const key = `${conflict.entityType}\u0000${conflict.entityId}`;
    conflicts.set(key, [...(conflicts.get(key) ?? []), conflict]);
  }
  const index: ProjectionIndex = { collections, conflicts, conflictGeneration: 0, cachedConflictGeneration: -1, cachedConflicts: [] };
  Object.defineProperty(projection, 'conflicts', {
    configurable: true,
    enumerable: true,
    get: () => {
      if (index.cachedConflictGeneration !== index.conflictGeneration) {
        index.cachedConflicts = [...index.conflicts.values()].flat().sort((left, right) => `${left.entityType}\u0000${left.entityId}\u0000${left.path}`.localeCompare(`${right.entityType}\u0000${right.entityId}\u0000${right.path}`));
        index.cachedConflictGeneration = index.conflictGeneration;
      }
      return index.cachedConflicts;
    },
  });
  projectionIndexes.set(projection, index);
  return index;
}

export function projectedTaskCurrentEntity(projection: TaskCurrentProjection, entityType: CollectionType, entityId: string): AnyRecord | null {
  return indexFor(projection).collections[entityType].values.get(entityId) ?? null;
}

function parentFor(target: AnyRecord, path: string, create: boolean): { parent: AnyRecord; key: string } | null {
  const parts = path.split('/').filter(Boolean);
  const key = parts.pop();
  if (!key) return null;
  let parent = target;
  for (const part of parts) {
    const value = parent[part];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      // WHAT: Create missing parents only for materialized values.
      // WHY: Removal candidates must not manufacture empty object paths.
      if (!create) return null;
      parent[part] = {};
    }
    parent = parent[part] as AnyRecord;
  }
  return { parent, key };
}

function applyCandidate(target: AnyRecord, path: string, candidate: TaskRegisterCandidate): void {
  const create = candidate.operation === 'set' || candidate.operation === 'add';
  const location = parentFor(target, path, create);
  if (!location) return;
  if (candidate.operation === 'set') location.parent[location.key] = structuredClone(candidate.value);
  if (candidate.operation === 'remove' || candidate.operation === 'tombstone') delete location.parent[location.key];
  if (candidate.operation === 'add') {
    const values = Array.isArray(location.parent[location.key]) ? location.parent[location.key] as unknown[] : [];
    if (!values.some((value) => canonicalJson(value) === canonicalJson(candidate.value))) values.push(structuredClone(candidate.value));
    location.parent[location.key] = values;
  }
}

function selectedCandidate(candidates: TaskRegisterCandidate[]): TaskRegisterCandidate | undefined {
  return candidates.slice().sort((left, right) => dotKey(left.dot).localeCompare(dotKey(right.dot)))[0];
}

function distinctCandidates(candidates: TaskRegisterCandidate[]): TaskRegisterCandidate[] {
  const effects = new Map<string, TaskRegisterCandidate>();
  for (const candidate of candidates.slice().sort((left, right) => dotKey(left.dot).localeCompare(dotKey(right.dot)))) {
    const effect = `${candidate.operation}\u0000${Object.hasOwn(candidate, 'value') ? canonicalJson(candidate.value) : ''}`;
    if (!effects.has(effect)) effects.set(effect, candidate);
  }
  return [...effects.values()];
}

function candidateRecord(candidate: TaskRegisterCandidate): TaskProjectionConflict['candidates'][number] {
  return {
    dot: structuredClone(candidate.dot),
    replicaId: candidate.dot.replicaId,
    operation: candidate.operation,
    ...(Object.hasOwn(candidate, 'value') ? { value: structuredClone(candidate.value) } : {}),
  };
}

export function materializeTaskCurrentEntity(projection: TaskCurrentProjection, entity: TaskCurrentEntity): void {
  if (entity.entityType === 'resource') return;
  const index = indexFor(projection);
  const entityKey = `${entity.entityType}\u0000${entity.entityId}`;
  const entityConflicts: TaskProjectionConflict[] = [];
  for (const register of Object.values(entity.fields)) {
    for (const [replicaId, counter] of Object.entries(register.clock)) {
      projection.clock[replicaId] = Math.max(projection.clock[replicaId] ?? 0, counter);
    }
  }

  const materialized: AnyRecord = entity.entityType === 'ledger' ? projection.ledger : { id: entity.entityId };
  const entityTombstone = selectedCandidate(entity.fields.$entity?.candidates ?? []);
  for (const [path, register] of Object.entries(entity.fields).sort(([left], [right]) => left.localeCompare(right))) {
    const candidates = distinctCandidates(register.candidates);
    const candidate = selectedCandidate(candidates);
    if (path !== '$entity' && candidate) applyCandidate(materialized, path, candidate);
    if (candidates.length > 1) {
      entityConflicts.push({
        kind: entity.entityType === 'card' && path === 'lifecycle' ? 'task-conflict' : 'state-conflict',
        emittedAt: '',
        entityType: entity.entityType,
        entityId: entity.entityId,
        path,
        candidates: candidates.map(candidateRecord),
      });
    }
  }
  if (entityConflicts.length > 0) index.conflicts.set(entityKey, entityConflicts);
  else index.conflicts.delete(entityKey);
  index.conflictGeneration += 1;

  if (entity.entityType === 'card' && materialized.lifecycle && typeof materialized.lifecycle === 'object' && !Array.isArray(materialized.lifecycle)) {
    // WHAT: Derive the compatibility card fields from the atomic lifecycle register.
    // WHY: Application readers keep their stable shape without making scalar fields independent CRDT authority.
    const lifecycle = materialized.lifecycle as AnyRecord;
    materialized.status = lifecycle.status;
    materialized.waitingAt = lifecycle.waitingAt;
    materialized.closedAt = lifecycle.closedAt;
  }

  if (entity.entityType === 'thread-note') {
    const separator = entity.entityId.lastIndexOf('/');
    // WHAT: Recover thread identity from the stable compound identity when a tombstone has no live field lanes.
    // WHY: A presence-only deletion must project under its original thread instead of an empty synthetic thread.
    const threadId = String(materialized.threadId ?? (separator > 0 ? entity.entityId.slice(0, separator) : ''));
    const noteId = entity.entityId.startsWith(`${threadId}/`) ? entity.entityId.slice(threadId.length + 1) : entity.entityId;
    materialized.id = noteId;
    delete materialized.threadId;
    const notesByThread = projection.ledger.notes && typeof projection.ledger.notes === 'object' && !Array.isArray(projection.ledger.notes)
      ? projection.ledger.notes as Record<string, AnyRecord[]>
      : {};
    const current = Array.isArray(notesByThread[threadId]) ? notesByThread[threadId] : [];
    const retained = current.filter((note) => String(note.id ?? '') !== noteId);
    if (entityTombstone?.operation !== 'tombstone') retained.push(materialized);
    notesByThread[threadId] = retained.sort((left, right) => String(left.timestamp ?? '').localeCompare(String(right.timestamp ?? '')) || String(left.id ?? '').localeCompare(String(right.id ?? '')));
    projection.ledger.notes = notesByThread;
    const deletedByThread = projection.ledger.deletedNoteIds && typeof projection.ledger.deletedNoteIds === 'object' && !Array.isArray(projection.ledger.deletedNoteIds)
      ? projection.ledger.deletedNoteIds as Record<string, string[]>
      : {};
    const deleted = new Set(Array.isArray(deletedByThread[threadId]) ? deletedByThread[threadId] : []);
    if (entityTombstone?.operation === 'tombstone') deleted.add(noteId);
    else deleted.delete(noteId);
    deletedByThread[threadId] = [...deleted].sort();
    projection.ledger.deletedNoteIds = deletedByThread;
  } else if (entity.entityType !== 'ledger') {
    const collection = index.collections[entity.entityType];
    if (entityTombstone?.operation === 'tombstone') collection.values.delete(entity.entityId);
    else collection.values.set(entity.entityId, materialized);
    collection.generation += 1;
  }
}
