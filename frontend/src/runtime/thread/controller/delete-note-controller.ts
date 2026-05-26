/**
 * WHAT: Deletes a specific note from a thread through the active ledger mutation path.
 * WHY: Conversation note deletion must target one note id instead of dropping the latest entry.
 */
import { modal } from '../../dom.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function deleteNoteController(input: string | { threadId: string; noteId?: string }): Promise<void> {
  const threadId = typeof input === 'string' ? input : input.threadId;
  const noteId = typeof input === 'string' ? '' : input.noteId ?? '';
  telemetry('delete-note-controller', { threadId, noteId });
  await commitActiveLedgerMutation({ action: 'delete-note', note: { threadId, id: noteId } }, { render: true });
  modal.close?.();
}
