/**
 * WHAT: Converts one offline ledger image into independent current-state entity changes.
 * WHY: Migration and empty-project initialization need the same deterministic lane boundaries.
 */
import type { TaskEntityChange } from './task-current-state-types.js';

export function taskCurrentBaselineChanges(ledger: Record<string, unknown>): TaskEntityChange[] {
  const changes: TaskEntityChange[] = [];
  for (const entityType of ['card', 'annotation', 'relationship'] as const) {
    const collection = `${entityType}s`;
    const entities = Array.isArray(ledger[collection]) ? ledger[collection] as Array<Record<string, unknown>> : [];
    for (const raw of entities) {
      const entityId = String(raw.id ?? '');
      if (!entityId) continue;
      const fields = Object.entries(raw)
        .filter(([path]) => path !== 'id')
        .map(([path, value]) => ({ path, operation: 'set' as const, value }));
      changes.push({ entityType, entityId, changes: fields });
    }
  }
  const notesByThread = ledger.notes && typeof ledger.notes === 'object' && !Array.isArray(ledger.notes) ? ledger.notes as Record<string, unknown> : {};
  for (const [threadId, rawNotes] of Object.entries(notesByThread)) {
    for (const note of Array.isArray(rawNotes) ? rawNotes as Array<Record<string, unknown>> : []) {
      const noteId = String(note.id ?? '');
      if (!noteId) continue;
      const fields = Object.entries({ ...note, threadId })
        .filter(([path]) => path !== 'id')
        .map(([path, value]) => ({ path, operation: 'set' as const, value }));
      changes.push({ entityType: 'thread-note', entityId: `${threadId}/${noteId}`, changes: fields });
    }
  }
  const deletedByThread = ledger.deletedNoteIds && typeof ledger.deletedNoteIds === 'object' && !Array.isArray(ledger.deletedNoteIds) ? ledger.deletedNoteIds as Record<string, unknown> : {};
  for (const [threadId, rawIds] of Object.entries(deletedByThread)) {
    const deletedNoteIds = Array.isArray(rawIds) ? rawIds.map(String).filter(Boolean) : [];
    for (const noteId of deletedNoteIds) {
      changes.push({
        entityType: 'thread-note',
        entityId: `${threadId}/${noteId}`,
        changes: [
          { path: 'threadId', operation: 'set', value: threadId },
          { path: '$entity', operation: 'tombstone' },
        ],
      });
    }
  }
  const collectionNames = new Set(['cards', 'annotations', 'relationships', 'notes', 'deletedNoteIds']);
  const ledgerChanges = Object.entries(ledger).filter(([path]) => !collectionNames.has(path)).map(([path, value]) => ({ path, operation: 'set' as const, value }));
  if (ledgerChanges.length > 0) changes.push({ entityType: 'ledger', entityId: 'tasks', changes: ledgerChanges });
  return changes;
}
