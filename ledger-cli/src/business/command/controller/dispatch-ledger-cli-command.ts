/**
 * WHAT: ledger-cli command dispatcher.
 * WHY: the ledger editing executable must route only ledger inspection and mutation commands.
 */
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { parseLedgerCliArgv } from '../helper/parse-ledger-cli-argv.js';
import { formatLedgerCliHelp } from '../helper/format-ledger-cli-help.js';
import { manageLedgerJsonController } from '../../ledger/controller/manage-ledger-json.js';
import { manageAssetsController } from '../../assets/controller/manage-assets.js';

export async function dispatchLedgerCliCommandController(
  argv: string[],
  ports: { fs?: FileSystemPort; emit?: (message: string) => void } = {},
): Promise<Result<unknown>> {
  telemetry('dispatch-ledger-cli-command', { argv });
  const command = parseLedgerCliArgv(argv);
  telemetry('parse-ledger-cli-argv', { mode: command.mode });

  if (command.mode === 'help') {
    const helpText = formatLedgerCliHelp();
    ports.emit ? ports.emit(helpText) : console.log(helpText);
    return { ok: true, value: helpText };
  }

  if (command.mode === 'assets') {
    const result = await manageAssetsController(command.assetOperation);
    if (result.ok) {
      ports.emit ? ports.emit(result.value) : console.log(result.value);
    }
    return result;
  }

  const result = await manageLedgerJsonController({
    answerOperation: command.answerOperation,
    exportOperation: command.exportOperation,
    json: command.json,
    ledgerCommand: command.mode,
    ledgerJsonFile: command.ledgerJsonFile,
    mutationFile: command.mutationFile,
    mutationOperation: command.mutationOperation,
    statusOperation: command.statusOperation,
  }, ports.fs);
  if (result.ok && (command.mode === 'export' || command.mode === 'overview' || command.mode === 'unanswered') && typeof result.value === 'string') {
    ports.emit ? ports.emit(result.value) : console.log(result.value);
  }
  return result;
}
