import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function deleteNoteController(threadId: string): Promise<void> {
  telemetry('delete-note-controller', { threadId });
  await commitActiveLedgerMutation({ action: 'delete-note', note: { threadId } }, { render: true });
}
