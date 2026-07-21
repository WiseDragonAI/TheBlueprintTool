/**
 * WHAT: Materializes one causal entity into the application ledger projection.
 * WHY: A changed card must update only its projection lane instead of rebuilding the workspace.
 */
import { canonicalJson } from './task-current-state-codec.js';
import { dotKey, joinTaskClocks } from './task-current-state-join.js';
import type { TaskCurrentEntity, TaskCurrentProjection, TaskFieldOperation, TaskProjectionConflict, TaskRegisterCandidate } from './task-current-state-types.js';

type AnyRecord = Record<string, unknown>;

const collectionByType = {
  card: 'cards',
  annotation: 'annotations',
  relationship: 'relationships',
} as const;

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
    const effect = `${candidate.operation}\u0000${canonicalJson(candidate.value)}`;
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
  projection.conflicts = projection.conflicts.filter((conflict) => conflict.entityType !== entity.entityType || conflict.entityId !== entity.entityId);
  for (const register of Object.values(entity.fields)) projection.clock = joinTaskClocks(projection.clock, register.clock);

  const materialized: AnyRecord = entity.entityType === 'ledger' ? projection.ledger : { id: entity.entityId };
  const entityTombstone = selectedCandidate(entity.fields.$entity?.candidates ?? []);
  for (const [path, register] of Object.entries(entity.fields).sort(([left], [right]) => left.localeCompare(right))) {
    const candidates = distinctCandidates(register.candidates);
    const candidate = selectedCandidate(candidates);
    if (path !== '$entity' && candidate) applyCandidate(materialized, path, candidate);
    if (candidates.length > 1) {
      projection.conflicts.push({
        emittedAt: '',
        entityType: entity.entityType,
        entityId: entity.entityId,
        path,
        candidates: candidates.map(candidateRecord),
      });
    }
  }

  if (entity.entityType === 'thread-note') {
    const threadId = String(materialized.threadId ?? '');
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
    const collectionName = collectionByType[entity.entityType];
    const collection = Array.isArray(projection.ledger[collectionName]) ? projection.ledger[collectionName] as AnyRecord[] : [];
    const retained = collection.filter((entry) => String(entry.id ?? '') !== entity.entityId);
    if (entityTombstone?.operation !== 'tombstone') retained.push(materialized);
    projection.ledger[collectionName] = retained;
  }
  projection.conflicts.sort((left, right) => `${left.entityType}\u0000${left.entityId}\u0000${left.path}`.localeCompare(`${right.entityType}\u0000${right.entityId}\u0000${right.path}`));
}
