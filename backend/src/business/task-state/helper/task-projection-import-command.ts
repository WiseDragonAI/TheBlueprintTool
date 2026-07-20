/**
 * WHAT: Declares every structural resource owned by an external task-projection import.
 * WHY: Migration and CLI compatibility may submit a projection, but the event authority still requires an explicit resource boundary.
 */
import type { TaskProjectionCommand } from './task-mutation-command.js';

type AnyRecord = Record<string, unknown>;

function entityIds(document: AnyRecord, collection: string): string[] {
  return Array.isArray(document[collection])
    ? (document[collection] as AnyRecord[]).map((entry) => String(entry.id ?? '')).filter(Boolean)
    : [];
}

export function taskProjectionImportCommand(before: AnyRecord, after: AnyRecord): TaskProjectionCommand {
  const ledgerPaths = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !['cards', 'annotations', 'relationships', 'notes', 'deletedNoteIds'].includes(key));
  return {
    kind: 'external-projection-import',
    cardIds: [...new Set([...entityIds(before, 'cards'), ...entityIds(after, 'cards')])],
    annotationIds: [...new Set([...entityIds(before, 'annotations'), ...entityIds(after, 'annotations')])],
    relationshipIds: [...new Set([...entityIds(before, 'relationships'), ...entityIds(after, 'relationships')])],
    ledgerPaths,
  };
}
