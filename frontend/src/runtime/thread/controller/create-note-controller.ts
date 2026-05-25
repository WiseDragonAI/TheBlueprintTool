/**
 * WHAT: Appends a text note to the active thread ledger.
 * WHY: The composer should only clear once the server confirms the note exists.
 */
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function createNoteController(input: { threadId: string; body: string }): Promise<boolean> {
  telemetry('create-note-controller', { threadId: input.threadId });
  return commitActiveLedgerMutation({ action: 'append-note', note: input }, { render: true });
}
