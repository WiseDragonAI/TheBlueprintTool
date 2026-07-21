/**
 * WHAT: Encodes one offline ledger image into canonical epoch-3 entity lanes.
 * WHY: Baseline migration, recovery, and runtime mutations must not emit legacy status or overlapping lanes.
 */
import type { TaskEntityChange, TaskFieldChange } from './task-current-state-types.js';
import { encodeTaskDomainLanes } from './task-domain-lane-encoder.js';

type AnyRecord = Record<string, unknown>;
const epoch = new Date(0).toISOString();
export function taskCurrentBaselineChanges(ledger: Record<string, unknown>): TaskEntityChange[] {
  const changes: TaskEntityChange[] = [];
  for (const entityType of ['card', 'annotation', 'relationship'] as const) {
    const collection = `${entityType}s`;
    const entities = Array.isArray(ledger[collection]) ? ledger[collection] as AnyRecord[] : [];
    for (const [index, raw] of entities.entries()) {
      const entityId = String(raw.id ?? '');
      if (!entityId) continue;
      const fields: TaskFieldChange[] = [...encodeTaskDomainLanes({ entityType, record: raw, transitionAt: epoch, relationshipPosition: index })]
        .map(([path, value]) => ({ path, operation: 'set', value }));
      changes.push({ entityType, entityId, changes: fields });
    }
  }
  const notesByThread = ledger.notes && typeof ledger.notes === 'object' && !Array.isArray(ledger.notes) ? ledger.notes as Record<string, unknown> : {};
  for (const [threadId, rawNotes] of Object.entries(notesByThread)) {
    for (const note of Array.isArray(rawNotes) ? rawNotes as AnyRecord[] : []) {
      const noteId = String(note.id ?? '');
      if (!noteId) continue;
      const fields = [...encodeTaskDomainLanes({ entityType: 'thread-note', record: { ...note, threadId }, transitionAt: epoch })]
        .map(([path, value]) => ({ path, operation: 'set' as const, value }));
      changes.push({ entityType: 'thread-note', entityId: `${threadId}/${noteId}`, changes: fields });
    }
  }
  const deletedByThread = ledger.deletedNoteIds && typeof ledger.deletedNoteIds === 'object' && !Array.isArray(ledger.deletedNoteIds) ? ledger.deletedNoteIds as Record<string, unknown> : {};
  for (const [threadId, rawIds] of Object.entries(deletedByThread)) {
    for (const noteId of Array.isArray(rawIds) ? rawIds.map(String).filter(Boolean) : []) {
      changes.push({ entityType: 'thread-note', entityId: `${threadId}/${noteId}`, changes: [{ path: 'threadId', operation: 'set', value: threadId }, { path: '$entity', operation: 'tombstone' }] });
    }
  }
  const collectionNames = new Set(['cards', 'annotations', 'relationships', 'notes', 'deletedNoteIds']);
  for (const [path, value] of Object.entries(ledger).filter(([path]) => !collectionNames.has(path))) {
    if (path === 'threadFiles' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [threadId, threadFile] of Object.entries(value as AnyRecord)) {
        changes.push({ entityType: 'ledger', entityId: 'tasks', changes: [{ path: `threadFiles/${threadId}`, operation: 'set', value: threadFile }] });
      }
    } else {
      changes.push({ entityType: 'ledger', entityId: 'tasks', changes: [{ path, operation: 'set', value }] });
    }
  }
  return changes;
}
