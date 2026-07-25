/**
 * WHAT: Converts accepted domain operations into granular structural task changes.
 * WHY: Current-state persistence must receive declared entity lanes instead of whole-ledger diffs.
 */
import type { LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { canonicalJson } from './task-current-state-codec.js';
import { encodeTaskDomainLanes } from './task-domain-lane-encoder.js';
import type { TaskEntityType, TaskFieldChange } from './task-current-state-types.js';

type AnyRecord = Record<string, unknown>;
export type TaskCommandChange = { entityType: TaskEntityType; entityId: string; changes: TaskFieldChange[] };
export type TaskMutationCommand = {
  kind: string;
  activationTaskId: string;
  replication: 'held' | 'active';
  changes: TaskCommandChange[];
};
export type TaskProjectionCommand = {
  kind: string;
  cardIds?: string[];
  annotationIds?: string[];
  relationshipIds?: string[];
  threadIds?: string[];
  threadNoteIds?: Record<string, string[]>;
  ledgerPaths?: string[];
};

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

function recordById(ledger: AnyRecord, collection: string, id: string): AnyRecord | null {
  return records(ledger[collection]).find((entry) => String(entry.id ?? '') === id) ?? null;
}

function changesBetween(entityType: TaskEntityType, before: AnyRecord | null, after: AnyRecord | null, transitionAt: string): TaskFieldChange[] {
  if (!after) return [{ path: '$entity', operation: 'tombstone' }];
  const left = before ? encodeTaskDomainLanes({ entityType, record: before, transitionAt }) : new Map<string, unknown>();
  const right = encodeTaskDomainLanes({ entityType, record: after, transitionAt });
  return [...new Set([...left.keys(), ...right.keys()])].sort().flatMap((path): TaskFieldChange[] => {
    if (!right.has(path)) return [{ path, operation: 'remove' }];
    if (!left.has(path) || canonicalJson(left.get(path)) !== canonicalJson(right.get(path))) return [{ path, operation: 'set', value: right.get(path) }];
    return [];
  });
}

function cardChangesBetween(before: AnyRecord | null, after: AnyRecord | null, transitionAt: string): TaskFieldChange[] {
  if (!after) return [{ path: '$entity', operation: 'tombstone' }];
  const left = before ? encodeTaskDomainLanes({ entityType: 'card', record: before, before, transitionAt }) : new Map<string, unknown>();
  const right = encodeTaskDomainLanes({ entityType: 'card', record: after, before, transitionAt });
  if (before && canonicalJson(left.get('createdAt')) !== canonicalJson(right.get('createdAt'))) throw new Error('immutable_card_created_at');
  return [...new Set([...left.keys(), ...right.keys()])].sort().flatMap((path): TaskFieldChange[] => {
    if (!right.has(path)) return [{ path, operation: 'remove' }];
    if (!left.has(path) || canonicalJson(left.get(path)) !== canonicalJson(right.get(path))) return [{ path, operation: 'set', value: right.get(path) }];
    return [];
  });
}

function entity(entityType: TaskEntityType, entityId: string, before: AnyRecord | null, after: AnyRecord | null, transitionAt = new Date().toISOString()): TaskCommandChange[] {
  const changes = entityType === 'card' ? cardChangesBetween(before, after, transitionAt) : changesBetween(entityType, before, after, transitionAt);
  return changes.length > 0 ? [{ entityType, entityId, changes }] : [];
}

function ledgerField(path: string, before: unknown, after: unknown): TaskCommandChange[] {
  if (before === undefined && after === undefined) return [];
  if (before !== undefined && after !== undefined && canonicalJson(before) === canonicalJson(after)) return [];
  return [{ entityType: 'ledger', entityId: 'tasks', changes: after === undefined ? [{ path, operation: 'remove' }] : [{ path, operation: 'set', value: structuredClone(after) }] }];
}

function valueAtPath(document: AnyRecord, path: string): unknown {
  return path.split('/').filter(Boolean).reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return (value as AnyRecord)[segment];
  }, document);
}

/** Converts an internal domain command into changes for its declared resource boundary only. */
export function taskCommandForProjection(input: { command: TaskProjectionCommand; before: AnyRecord; after: AnyRecord }): TaskCommandChange[] {
  const changes: TaskCommandChange[] = [];
  for (const id of new Set(input.command.cardIds ?? [])) {
    changes.push(...entity('card', id, recordById(input.before, 'cards', id), recordById(input.after, 'cards', id)));
  }
  for (const id of new Set(input.command.annotationIds ?? [])) {
    changes.push(...entity('annotation', id, recordById(input.before, 'annotations', id), recordById(input.after, 'annotations', id)));
  }
  for (const id of new Set(input.command.relationshipIds ?? [])) {
    changes.push(...entity('relationship', id, recordById(input.before, 'relationships', id), recordById(input.after, 'relationships', id)));
  }
  for (const threadId of new Set(input.command.threadIds ?? [])) {
    changes.push(...threadNoteChanges(input.before, input.after, threadId, input.command.threadNoteIds?.[threadId]));
  }
  for (const path of new Set(input.command.ledgerPaths ?? [])) {
    changes.push(...ledgerField(path, valueAtPath(input.before, path), valueAtPath(input.after, path)));
  }
  return changes;
}

function taskIdFromThread(threadId: string): string {
  return threadId.startsWith('thread-') ? threadId.slice('thread-'.length) : '';
}

function threadNoteChanges(before: AnyRecord, after: AnyRecord, threadId: string, noteIds?: string[]): TaskCommandChange[] {
  const notes = (ledger: AnyRecord): AnyRecord[] => {
    const values = ledger.notes && typeof ledger.notes === 'object' && !Array.isArray(ledger.notes)
      ? (ledger.notes as Record<string, unknown>)[threadId]
      : [];
    return records(values);
  };
  const left = new Map(notes(before).map((note) => [String(note.id ?? ''), note]));
  const right = new Map(notes(after).map((note) => [String(note.id ?? ''), note]));
  const ownedIds = noteIds ?? [...left.keys(), ...right.keys()];
  const beforeRefs = before.threadFiles && typeof before.threadFiles === 'object' ? before.threadFiles as AnyRecord : {};
  const afterRefs = after.threadFiles && typeof after.threadFiles === 'object' ? after.threadFiles as AnyRecord : {};
  return [
    ...ledgerField(`threadFiles/${threadId}`, beforeRefs[threadId], afterRefs[threadId]),
    ...[...new Set(ownedIds)].filter(Boolean).flatMap((noteId) => entity(
    'thread-note',
    `${threadId}/${noteId}`,
    left.has(noteId) ? { ...left.get(noteId), threadId } : null,
    right.has(noteId) ? { ...right.get(noteId), threadId } : null,
    )),
  ];
}

function restoreThreadNote(before: AnyRecord, after: AnyRecord, threadId: string, noteId: string): TaskCommandChange[] {
  const scoped = threadNoteChanges(before, after, threadId, [noteId]);
  if (scoped.length === 0) return [];
  scoped[0].changes.unshift({ path: '$entity', operation: 'remove' });
  return scoped;
}

/** Converts one accepted UI operation into changes for only the entities that operation owns. */
export function taskCommandForMutation(input: { mutation: LedgerMutation; before: AnyRecord; after: AnyRecord }): TaskMutationCommand {
  const { mutation, before, after } = input;
  const action = String(mutation.action ?? '');
  const changes: TaskCommandChange[] = [];
  let activationTaskId = '';
  let replication: 'held' | 'active' = 'active';

  if (action === 'create-master-task' && mutation.card?.id && mutation.annotation?.id) {
    const cards = [mutation.card, ...records(mutation.cards)];
    const relationships = records(mutation.relationships);
    activationTaskId = String(mutation.card.id);
    replication = 'held';
    changes.push(...entity('annotation', String(mutation.annotation.id), null, recordById(after, 'annotations', String(mutation.annotation.id))));
    for (const card of cards) {
      const cardId = String(card.id ?? '');
      changes.push(...entity('card', cardId, null, recordById(after, 'cards', cardId)));
      const threadId = `thread-${cardId}`;
      const beforeRefs = before.threadFiles && typeof before.threadFiles === 'object' ? before.threadFiles as AnyRecord : {};
      const afterRefs = after.threadFiles && typeof after.threadFiles === 'object' ? after.threadFiles as AnyRecord : {};
      changes.push(...ledgerField(`threadFiles/${threadId}`, beforeRefs[threadId], afterRefs[threadId]));
    }
    for (const relationship of relationships) {
      const relationshipId = String(relationship.id ?? '');
      changes.push(...entity('relationship', relationshipId, null, recordById(after, 'relationships', relationshipId)));
    }
  } else if (action === 'create-task-intake' && mutation.card?.id && mutation.annotation?.id) {
    const cardId = String(mutation.card.id);
    const annotationId = String(mutation.annotation.id);
    activationTaskId = cardId;
    replication = 'held';
    changes.push(...entity('annotation', annotationId, null, recordById(after, 'annotations', annotationId)));
    changes.push(...entity('card', cardId, null, recordById(after, 'cards', cardId)));
    const threadId = `thread-${cardId}`;
    const beforeRefs = before.threadFiles && typeof before.threadFiles === 'object' ? before.threadFiles as AnyRecord : {};
    const afterRefs = after.threadFiles && typeof after.threadFiles === 'object' ? after.threadFiles as AnyRecord : {};
    changes.push(...ledgerField(`threadFiles/${threadId}`, beforeRefs[threadId], afterRefs[threadId]));
  } else if ((action === 'create-zone' || action === 'create-group') && mutation.annotation?.id) {
    const id = String(mutation.annotation.id);
    changes.push(...entity('annotation', id, null, recordById(after, 'annotations', id)));
  } else if (action === 'create-card' && mutation.card?.id) {
    const id = String(mutation.card.id);
    activationTaskId = id;
    replication = 'held';
    changes.push(...entity('card', id, null, recordById(after, 'cards', id)));
    const threadId = `thread-${id}`;
    const beforeRefs = before.threadFiles && typeof before.threadFiles === 'object' ? before.threadFiles as AnyRecord : {};
    const afterRefs = after.threadFiles && typeof after.threadFiles === 'object' ? after.threadFiles as AnyRecord : {};
    changes.push(...ledgerField(`threadFiles/${threadId}`, beforeRefs[threadId], afterRefs[threadId]));
  } else if (action === 'create-relationship' && mutation.relationship?.id) {
    const id = String(mutation.relationship.id);
    changes.push(...entity('relationship', id, null, recordById(after, 'relationships', id)));
  } else if (action === 'transition-card-lifecycle' && mutation.cardId) {
    const id = String(mutation.cardId);
    activationTaskId = id;
    changes.push(...entity('card', id, recordById(before, 'cards', id), recordById(after, 'cards', id)));
  } else if (action === 'reassign-task' && mutation.cardId) {
    const id = String(mutation.cardId);
    activationTaskId = id;
    changes.push(...entity('card', id, recordById(before, 'cards', id), recordById(after, 'cards', id)));
  } else if (action === 'patch-card' && mutation.cardPatch?.id) {
    const id = String(mutation.cardPatch.id);
    activationTaskId = id;
    changes.push(...entity('card', id, recordById(before, 'cards', id), recordById(after, 'cards', id)));
  } else if (action === 'complete-master-task' && mutation.masterTaskId) {
    const rootId = String(mutation.masterTaskId);
    activationTaskId = rootId;
    const childIds = records(before.relationships)
      .filter((relationship) => String(relationship.from ?? '') === rootId && String(relationship.label ?? '') === 'subtask')
      .sort((left, right) => Number(left.position) - Number(right.position) || String(left.id ?? '').localeCompare(String(right.id ?? '')))
      .map((relationship) => String(relationship.to ?? ''));
    for (const id of [rootId, ...childIds]) changes.push(...entity('card', id, recordById(before, 'cards', id), recordById(after, 'cards', id)));
  } else if (action === 'delete-card' && mutation.cardId) {
    const id = String(mutation.cardId);
    activationTaskId = id;
    changes.push(...entity('card', id, recordById(before, 'cards', id), null));
    for (const relationship of records(before.relationships).filter((entry) => String(entry.from ?? '') === id || String(entry.to ?? '') === id)) {
      changes.push(...entity('relationship', String(relationship.id ?? ''), relationship, null));
    }
    const refs = before.threadFiles && typeof before.threadFiles === 'object' ? before.threadFiles as AnyRecord : {};
    changes.push(...ledgerField(`threadFiles/thread-${id}`, refs[`thread-${id}`], undefined));
  } else if (action === 'delete-zones') {
    for (const id of [...(mutation.zoneIds ?? []), ...(mutation.groupIds ?? [])]) changes.push(...entity('annotation', id, recordById(before, 'annotations', id), null));
  } else if (action === 'delete-relationships') {
    for (const id of mutation.relationshipIds ?? []) changes.push(...entity('relationship', id, recordById(before, 'relationships', id), null));
  } else if (action === 'patch-geometry') {
    for (const [id] of Object.entries(mutation.geometry?.cards ?? {})) changes.push(...entity('card', id, recordById(before, 'cards', id), recordById(after, 'cards', id)));
    for (const [id] of Object.entries({ ...(mutation.geometry?.zones ?? {}), ...(mutation.geometry?.groups ?? {}) })) changes.push(...entity('annotation', id, recordById(before, 'annotations', id), recordById(after, 'annotations', id)));
  } else if (action === 'patch-viewport') {
    changes.push(...ledgerField('viewport', before.viewport, after.viewport));
  } else if (action === 'patch-region' && mutation.region?.id) {
    const id = String(mutation.region.id);
    changes.push(...entity('annotation', id, recordById(before, 'annotations', id), recordById(after, 'annotations', id)));
  } else if (action === 'paste-selection') {
    const previousCardIds = new Set(records(before.cards).map((entry) => String(entry.id ?? '')));
    const previousAnnotationIds = new Set(records(before.annotations).map((entry) => String(entry.id ?? '')));
    for (const card of records(after.cards).filter((entry) => !previousCardIds.has(String(entry.id ?? '')))) changes.push(...entity('card', String(card.id ?? ''), null, card));
    for (const annotation of records(after.annotations).filter((entry) => !previousAnnotationIds.has(String(entry.id ?? '')))) changes.push(...entity('annotation', String(annotation.id ?? ''), null, annotation));
  } else if (['append-note', 'update-note', 'delete-note', 'restore-note', 'delete-card-image'].includes(action)) {
    activationTaskId = taskIdFromThread(String(mutation.note?.threadId ?? '')) || String(mutation.cardId ?? '');
    if (mutation.note?.threadId) {
      const noteId = String(mutation.note.id ?? '');
      if (!noteId) throw new Error(`note_identity_required:${action}`);
      changes.push(...(action === 'restore-note'
        ? restoreThreadNote(before, after, mutation.note.threadId, noteId)
        : threadNoteChanges(before, after, mutation.note.threadId, [noteId])));
    }
  } else {
    throw new Error(`unsupported_task_command:${action || 'missing'}`);
  }

  return { kind: action, activationTaskId, replication, changes };
}
