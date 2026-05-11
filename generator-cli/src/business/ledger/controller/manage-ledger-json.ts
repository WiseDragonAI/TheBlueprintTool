/**
 * WHAT: Ledger JSON command controller.
 * WHY: CLI architecture edits must use committed ledger files as the work surface.
 */
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { readLedgerJson } from '../helper/read-ledger-json.js';
import { writeLedgerJson } from '../effect/write-ledger-json.js';

export async function manageLedgerJsonController(
  actionPayload: {
    ledgerCommand: 'inspect' | 'mutate';
    ledgerJsonFile: string;
    mutation?: unknown;
  },
  fs?: FileSystemPort,
): Promise<Result<unknown>> {
  telemetry('read-ledger-json', { path: actionPayload.ledgerJsonFile });
  const ledger = await readLedgerJson(actionPayload.ledgerJsonFile, fs);

  // WHY: invalid JSON cannot be used as committed architecture truth.
  // WHAT: stop before any mutation write.
  if (!ledger.ok) {
    telemetry('manage-ledger-json-rejected', { error: ledger.error });
    return ledger;
  }

  // WHY: mutate mode is the only ledger command allowed to write.
  // WHAT: persist either the provided mutation object or the current validated ledger.
  if (actionPayload.ledgerCommand === 'mutate') {
    await writeLedgerJson(actionPayload.ledgerJsonFile, actionPayload.mutation ?? ledger.value, fs);
    telemetry('write-ledger-json', { path: actionPayload.ledgerJsonFile });
  }

  telemetry('manage-ledger-json-completed');
  return ledger;
}
