/**
 * WHAT: Declares every structural resource owned by an external task-projection import.
 * WHY: Explicit imports must declare their affected lanes instead of diffing unrelated current entities.
 */
import type { TaskProjectionCommand } from './task-mutation-command.js';

type AnyRecord = Record<string, unknown>;

function entityIds(document: AnyRecord, collection: string): string[] {
  return Array.isArray(document[collection])
    ? (document[collection] as AnyRecord[]).map((entry) => String(entry.id ?? '')).filter(Boolean)
    : [];
}

function threadIds(document: AnyRecord): string[] {
  if (!document.notes || typeof document.notes !== 'object' || Array.isArray(document.notes)) return [];
  return Object.keys(document.notes);
}

export function taskProjectionImportCommand(before: AnyRecord, after: AnyRecord): TaskProjectionCommand {
  const ledgerPaths = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !['cards', 'annotations', 'relationships', 'notes', 'deletedNoteIds'].includes(key));
  return {
    kind: 'external-projection-import',
    cardIds: [...new Set([...entityIds(before, 'cards'), ...entityIds(after, 'cards')])],
    annotationIds: [...new Set([...entityIds(before, 'annotations'), ...entityIds(after, 'annotations')])],
    relationshipIds: [...new Set([...entityIds(before, 'relationships'), ...entityIds(after, 'relationships')])],
    threadIds: [...new Set([...threadIds(before), ...threadIds(after)])],
    ledgerPaths,
  };
}
