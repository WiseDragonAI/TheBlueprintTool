/**
 * WHAT: ledger-cli command dispatcher.
 * WHY: the ledger editing executable must route only ledger inspection and mutation commands.
 */
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { parseLedgerCliArgv } from '../helper/parse-ledger-cli-argv.js';
import { manageLedgerJsonController } from '../../ledger/controller/manage-ledger-json.js';

export async function dispatchLedgerCliCommandController(
  argv: string[],
  ports: { fs?: FileSystemPort; emit?: (message: string) => void } = {},
): Promise<Result<unknown>> {
  telemetry('dispatch-ledger-cli-command', { argv });
  const command = parseLedgerCliArgv(argv);
  telemetry('parse-ledger-cli-argv', { mode: command.mode });

  const result = await manageLedgerJsonController({
    ledgerCommand: command.mode,
    ledgerJsonFile: command.ledgerJsonFile,
    mutationFile: command.mutationFile,
    mutationOperation: command.mutationOperation,
    statusOperation: command.statusOperation,
  }, ports.fs);
  if (result.ok && command.mode === 'overview' && typeof result.value === 'string') {
    ports.emit ? ports.emit(result.value) : console.log(result.value);
  }
  return result;
}
