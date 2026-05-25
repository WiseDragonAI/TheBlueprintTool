/**
 * WHAT: generator-cli command dispatcher.
 * WHY: one executable entrypoint must branch to dry-run, apply, report, patch-doc, and ledger controllers.
 */
import type { FileSystemPort, ProcessPort, Result } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { parseCliArgv } from '../helper/parse-cli-argv.js';
import { planGeneratedWorktreeController } from '../../generate/controller/plan-generated-worktree.js';
import { applyGeneratedWorktreeController } from '../../generate/controller/apply-generated-worktree.js';
import { runReportModeController } from '../../report/controller/run-report-mode.js';
import { applyPatchDocController } from '../../patch-doc/controller/apply-patch-doc.js';
import { manageLedgerJsonController } from '../../ledger/controller/manage-ledger-json.js';
import { resolveGeneratedDependenciesController } from '../../graph/controller/resolve-generated-dependencies.js';
import { loadAndValidateMasterLedgerController } from '../../master-ledger/controller/load-and-validate-master-ledger.js';
import { checkMasterLedgerController } from '../../report/controller/check-master-ledger.js';

export async function dispatchCliCommandController(
  argv: string[],
  ports: { fs?: FileSystemPort; process?: ProcessPort; cwd?: string; emit?: (message: string) => void } = {},
): Promise<Result<unknown>> {
  telemetry('dispatch-cli-command', { argv });
  const command = parseCliArgv(argv);
  telemetry('parse-cli-argv', { mode: command.mode });

  // WHY: dry-run prints the plan and does not write the worktree.
  // WHAT: call the planning controller.
  if (command.mode === 'dry-run') {
    return planGeneratedWorktreeController({ ...command, emit: ports.emit }, ports.fs);
  }

  // WHY: apply writes the complete generated worktree.
  // WHAT: call the apply controller.
  if (command.mode === 'apply') {
    return applyGeneratedWorktreeController(command, ports);
  }

  // WHY: check-ledger must report parser counts and structural problems without writing generated files.
  // WHAT: run the checker and emit its report.
  if (command.mode === 'check-ledger') {
    const checked = await checkMasterLedgerController({
      masterLedgerFile: command.masterLedgerFile,
      specsLedgerFile: command.specsLedgerFile,
      groups: command.groups,
    }, ports.fs);

    // WHY: unreadable ledgers should fail before report formatting.
    // WHAT: return the read failure.
    if (!checked.ok) {
      return checked;
    }

    const reportText = JSON.stringify(checked.value, null, 2);
    ports.emit ? ports.emit(reportText) : console.log(reportText);
    return checked.value.ok ? checked : { ok: false, error: 'MasterLedger check failed.' };
  }

  // WHY: report mode needs functions and graph to build unused function evidence.
  // WHAT: load the default ledger if available, then run report mode.
  if (command.mode === 'report') {
    const loaded = await loadAndValidateMasterLedgerController('../tmp/master-ledger-generator-cli-26-05-11-1.md', ports.fs);
    const functions = loaded.ok ? loaded.value.functions : [];
    const graph = resolveGeneratedDependenciesController(functions);
    await runReportModeController({ ...command, functions, graph }, ports);
    return { ok: true, value: command.reportFile };
  }

  // WHY: patch-doc edits canonical documents in one batch.
  // WHAT: call patch-doc controller.
  if (command.mode === 'patch-doc') {
    return applyPatchDocController(command.patchBatchFile, ports.fs);
  }

  // WHY: ledger mode reads or mutates committed JSON ledgers.
  // WHAT: call ledger controller.
  if (command.mode === 'ledger') {
    const result = await manageLedgerJsonController({
      ledgerCommand: command.ledgerCommand,
      ledgerJsonFile: command.ledgerJsonFile,
      mutationFile: command.mutationFile,
      mutationOperation: command.mutationOperation,
    }, ports.fs);
    if (result.ok && command.ledgerCommand === 'overview' && typeof result.value === 'string') {
      ports.emit ? ports.emit(result.value) : console.log(result.value);
    }
    return result;
  }

  telemetry('dispatch-cli-command-rejected');
  return { ok: false, error: 'Unsupported command mode.' };
}
