import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function createNoteController(input: { threadId: string; body: string }): Promise<void> {
  telemetry('create-note-controller', { threadId: input.threadId });
  await commitActiveLedgerMutation({ action: 'append-note', note: input }, { render: true });
}
