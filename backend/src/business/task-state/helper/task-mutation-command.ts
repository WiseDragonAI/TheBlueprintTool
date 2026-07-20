/**
 * WHAT: Converts accepted domain operations into granular structural task events.
 * WHY: The task event log must receive declared resource changes instead of whole-ledger diffs.
 */
import type { LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { canonicalJson } from './task-event-codec.js';
import type { TaskEntityType, TaskFieldChange } from './task-event-types.js';

type AnyRecord = Record<string, unknown>;
export type TaskCommandEvent = { entityType: TaskEntityType; entityId: string; changes: TaskFieldChange[] };
export type TaskMutationCommand = {
  kind: string;
  activationTaskId: string;
  replication: 'held' | 'pending';
  events: TaskCommandEvent[];
};
export type TaskProjectionCommand = {
  kind: string;
  cardIds?: string[];
  annotationIds?: string[];
  relationshipIds?: string[];
  ledgerPaths?: string[];
};

const contentFields = new Set(['description', 'what', 'notes', 'deletedNoteIds', 'content', 'contentBytes', 'markdown']);

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

function recordById(ledger: AnyRecord, collection: string, id: string): AnyRecord | null {
  return records(ledger[collection]).find((entry) => String(entry.id ?? '') === id) ?? null;
}

function structural(value: unknown): unknown {
  if (Array.isArray(value)) return structuredClone(value);
  if (!value || typeof value !== 'object') return value;
  const result: AnyRecord = {};
  for (const [key, child] of Object.entries(value as AnyRecord)) {
    if (contentFields.has(key)) continue;
    result[key] = structural(child);
  }
  return result;
}

function flatten(value: AnyRecord, prefix: string[] = []): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const [key, raw] of Object.entries(value)) {
    if (key === 'id' || contentFields.has(key)) continue;
    const path = [...prefix, key];
    const next = structural(raw);
    if (next && typeof next === 'object' && !Array.isArray(next) && key !== 'comment') {
      for (const [nestedPath, nestedValue] of flatten(next as AnyRecord, path)) result.set(nestedPath, nestedValue);
    } else result.set(path.join('/'), next);
  }
  return result;
}

function changesBetween(before: AnyRecord | null, after: AnyRecord | null): TaskFieldChange[] {
  if (!after) return [{ path: '$entity', operation: 'tombstone' }];
  const left = before ? flatten(before) : new Map<string, unknown>();
  const right = flatten(after);
  return [...new Set([...left.keys(), ...right.keys()])].sort().flatMap((path): TaskFieldChange[] => {
    if (!right.has(path)) return [{ path, operation: 'remove' }];
    if (!left.has(path) || canonicalJson(left.get(path)) !== canonicalJson(right.get(path))) return [{ path, operation: 'set', value: right.get(path) }];
    return [];
  });
}

function entity(entityType: TaskEntityType, entityId: string, before: AnyRecord | null, after: AnyRecord | null): TaskCommandEvent[] {
  const changes = changesBetween(before, after);
  return changes.length > 0 ? [{ entityType, entityId, changes }] : [];
}

function ledgerField(path: string, before: unknown, after: unknown): TaskCommandEvent[] {
  if (canonicalJson(before) === canonicalJson(after)) return [];
  return [{ entityType: 'ledger', entityId: 'tasks', changes: after === undefined ? [{ path, operation: 'remove' }] : [{ path, operation: 'set', value: structuredClone(after) }] }];
}

function valueAtPath(document: AnyRecord, path: string): unknown {
  return path.split('/').filter(Boolean).reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return (value as AnyRecord)[segment];
  }, document);
}

/** Converts an internal domain command into events for its declared resource boundary only. */
export function taskCommandForProjection(input: { command: TaskProjectionCommand; before: AnyRecord; after: AnyRecord }): TaskCommandEvent[] {
  const events: TaskCommandEvent[] = [];
  for (const id of new Set(input.command.cardIds ?? [])) {
    events.push(...entity('card', id, recordById(input.before, 'cards', id), recordById(input.after, 'cards', id)));
  }
  for (const id of new Set(input.command.annotationIds ?? [])) {
    events.push(...entity('annotation', id, recordById(input.before, 'annotations', id), recordById(input.after, 'annotations', id)));
  }
  for (const id of new Set(input.command.relationshipIds ?? [])) {
    events.push(...entity('relationship', id, recordById(input.before, 'relationships', id), recordById(input.after, 'relationships', id)));
  }
  for (const path of new Set(input.command.ledgerPaths ?? [])) {
    events.push(...ledgerField(path, valueAtPath(input.before, path), valueAtPath(input.after, path)));
  }
  return events;
}

function taskIdFromThread(threadId: string): string {
  return threadId.startsWith('thread-') ? threadId.slice('thread-'.length) : '';
}

/** Converts one accepted UI operation into events for only the entities that operation owns. */
export function taskCommandForMutation(input: { mutation: LedgerMutation; before: AnyRecord; after: AnyRecord }): TaskMutationCommand {
  const { mutation, before, after } = input;
  const action = String(mutation.action ?? '');
  const events: TaskCommandEvent[] = [];
  let activationTaskId = '';
  let replication: 'held' | 'pending' = 'pending';

  if (action === 'create-task-intake' && mutation.card?.id && mutation.annotation?.id) {
    const cardId = String(mutation.card.id);
    const annotationId = String(mutation.annotation.id);
    activationTaskId = cardId;
    replication = 'held';
    events.push(...entity('annotation', annotationId, null, recordById(after, 'annotations', annotationId)));
    events.push(...entity('card', cardId, null, recordById(after, 'cards', cardId)));
    const cardEvent = events.find((event) => event.entityType === 'card' && event.entityId === cardId);
    cardEvent?.changes.push({ path: 'replicationState', operation: 'set', value: 'local-only' });
    const threadId = `thread-${cardId}`;
    const beforeRefs = before.threadFiles && typeof before.threadFiles === 'object' ? before.threadFiles as AnyRecord : {};
    const afterRefs = after.threadFiles && typeof after.threadFiles === 'object' ? after.threadFiles as AnyRecord : {};
    events.push(...ledgerField(`threadFiles/${threadId}`, beforeRefs[threadId], afterRefs[threadId]));
  } else if ((action === 'create-zone' || action === 'create-group') && mutation.annotation?.id) {
    const id = String(mutation.annotation.id);
    events.push(...entity('annotation', id, null, recordById(after, 'annotations', id)));
  } else if (action === 'create-card' && mutation.card?.id) {
    const id = String(mutation.card.id);
    activationTaskId = id;
    replication = 'held';
    events.push(...entity('card', id, null, recordById(after, 'cards', id)));
    const cardEvent = events.find((event) => event.entityType === 'card' && event.entityId === id);
    cardEvent?.changes.push({ path: 'replicationState', operation: 'set', value: 'local-only' });
    const threadId = `thread-${id}`;
    const beforeRefs = before.threadFiles && typeof before.threadFiles === 'object' ? before.threadFiles as AnyRecord : {};
    const afterRefs = after.threadFiles && typeof after.threadFiles === 'object' ? after.threadFiles as AnyRecord : {};
    events.push(...ledgerField(`threadFiles/${threadId}`, beforeRefs[threadId], afterRefs[threadId]));
  } else if (action === 'create-relationship' && mutation.relationship?.id) {
    const id = String(mutation.relationship.id);
    events.push(...entity('relationship', id, null, recordById(after, 'relationships', id)));
  } else if (action === 'patch-card' && mutation.cardPatch?.id) {
    const id = String(mutation.cardPatch.id);
    activationTaskId = id;
    events.push(...entity('card', id, recordById(before, 'cards', id), recordById(after, 'cards', id)));
  } else if (action === 'complete-master-task' && mutation.masterTaskId) {
    const rootId = String(mutation.masterTaskId);
    activationTaskId = rootId;
    const childIds = records(before.relationships)
      .filter((relationship) => String(relationship.from ?? '') === rootId && String(relationship.label ?? '') === 'subtask')
      .map((relationship) => String(relationship.to ?? ''));
    for (const id of [rootId, ...childIds]) events.push(...entity('card', id, recordById(before, 'cards', id), recordById(after, 'cards', id)));
  } else if (action === 'delete-card' && mutation.cardId) {
    const id = String(mutation.cardId);
    activationTaskId = id;
    events.push(...entity('card', id, recordById(before, 'cards', id), null));
    for (const relationship of records(before.relationships).filter((entry) => String(entry.from ?? '') === id || String(entry.to ?? '') === id)) {
      events.push(...entity('relationship', String(relationship.id ?? ''), relationship, null));
    }
    const refs = before.threadFiles && typeof before.threadFiles === 'object' ? before.threadFiles as AnyRecord : {};
    events.push(...ledgerField(`threadFiles/thread-${id}`, refs[`thread-${id}`], undefined));
  } else if (action === 'delete-zones') {
    for (const id of [...(mutation.zoneIds ?? []), ...(mutation.groupIds ?? [])]) events.push(...entity('annotation', id, recordById(before, 'annotations', id), null));
  } else if (action === 'delete-relationships') {
    for (const id of mutation.relationshipIds ?? []) events.push(...entity('relationship', id, recordById(before, 'relationships', id), null));
  } else if (action === 'patch-geometry') {
    for (const [id] of Object.entries(mutation.geometry?.cards ?? {})) events.push(...entity('card', id, recordById(before, 'cards', id), recordById(after, 'cards', id)));
    for (const [id] of Object.entries({ ...(mutation.geometry?.zones ?? {}), ...(mutation.geometry?.groups ?? {}) })) events.push(...entity('annotation', id, recordById(before, 'annotations', id), recordById(after, 'annotations', id)));
  } else if (action === 'patch-viewport') {
    events.push(...ledgerField('viewport', before.viewport, after.viewport));
  } else if (action === 'patch-region' && mutation.region?.id) {
    const id = String(mutation.region.id);
    events.push(...entity('annotation', id, recordById(before, 'annotations', id), recordById(after, 'annotations', id)));
  } else if (action === 'create-execution-intent' && mutation.cardId) {
    const id = String(mutation.cardId);
    activationTaskId = id;
    events.push(...entity('card', id, recordById(before, 'cards', id), recordById(after, 'cards', id)));
  } else if (action === 'paste-selection') {
    const previousCardIds = new Set(records(before.cards).map((entry) => String(entry.id ?? '')));
    const previousAnnotationIds = new Set(records(before.annotations).map((entry) => String(entry.id ?? '')));
    for (const card of records(after.cards).filter((entry) => !previousCardIds.has(String(entry.id ?? '')))) events.push(...entity('card', String(card.id ?? ''), null, card));
    for (const annotation of records(after.annotations).filter((entry) => !previousAnnotationIds.has(String(entry.id ?? '')))) events.push(...entity('annotation', String(annotation.id ?? ''), null, annotation));
  } else if (['append-note', 'update-note', 'delete-note', 'delete-card-image'].includes(action)) {
    activationTaskId = taskIdFromThread(String(mutation.note?.threadId ?? '')) || String(mutation.cardId ?? '');
  } else {
    throw new Error(`unsupported_task_command:${action || 'missing'}`);
  }

  return { kind: action, activationTaskId, replication, events };
}
