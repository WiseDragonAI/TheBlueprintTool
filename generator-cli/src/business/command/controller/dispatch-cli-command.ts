/**
 * WHAT: Generated controller function dispatch-cli-command.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';
import { applyGeneratedWorktreeController } from '../../generate/controller/apply-generated-worktree.js';
import { applyPatchDocController } from '../../patch-doc/controller/apply-patch-doc.js';
import { checkMasterLedgerController } from '../../report/controller/check-master-ledger.js';
import { manageLedgerJsonController } from '../../ledger/controller/manage-ledger-json.js';
import { parseCliArgv } from '../helper/parse-cli-argv.js';
import { planGeneratedWorktreeController } from '../../generate/controller/plan-generated-worktree.js';
import { runReportModeController } from '../../report/controller/run-report-mode.js';


export async function dispatchCliCommandController({
  action_payload,
}: {
  action_payload: {
    cli_command_argv: string[]
  }
}) {
  telemetry('controller:dispatch-cli-command -> start', { functionName: 'dispatch-cli-command', arguments: { action_payload }, phase: 'started' });
  telemetry('controller:dispatch-cli-command -> emit-dispatch-cli-command-started', { functionName: 'emit-dispatch-cli-command-started', arguments: { action_payload }, phase: 'event' })

  // WHAT: parse CLI argv into the operator-requested command.
  // WHY: one executable entrypoint must branch into all generator modes.
  // HOW: parse argv, then call the controller that owns the selected mode.
  const command = parseCliArgv(action_payload.cli_command_argv)

  if (command.mode === 'dry-run') {
    telemetry('controller:dispatch-cli-command -> parse-cli-argv', { functionName: 'parse-cli-argv', arguments: { action_payload }, phase: 'event' })
    await planGeneratedWorktreeController({ action_payload: command })
    return
  }

  if (command.mode === 'apply') {
    telemetry('controller:dispatch-cli-command -> parse-cli-argv', { functionName: 'parse-cli-argv', arguments: { action_payload }, phase: 'event' })
    await applyGeneratedWorktreeController({ action_payload: command })
    return
  }

  if (command.mode === 'report') {
    telemetry('controller:dispatch-cli-command -> parse-cli-argv', { functionName: 'parse-cli-argv', arguments: { action_payload }, phase: 'event' })
    await runReportModeController({ action_payload: command })
    return
  }

  if (command.mode === 'check-ledger') {
    telemetry('controller:dispatch-cli-command -> parse-cli-argv', { functionName: 'parse-cli-argv', arguments: { action_payload }, phase: 'event' })
    await checkMasterLedgerController({ action_payload: command })
    return
  }

  if (command.mode === 'patch-doc') {
    telemetry('controller:dispatch-cli-command -> parse-cli-argv', { functionName: 'parse-cli-argv', arguments: { action_payload }, phase: 'event' })
    await applyPatchDocController({ action_payload: command })
    return
  }

  if (command.mode === 'ledger') {
    telemetry('controller:dispatch-cli-command -> parse-cli-argv', { functionName: 'parse-cli-argv', arguments: { action_payload }, phase: 'event' })
    await manageLedgerJsonController({ action_payload: command })
    return
  }

  telemetry('controller:dispatch-cli-command -> dispatch-cli-command-rejected', { functionName: 'dispatch-cli-command-rejected', arguments: { action_payload }, phase: 'event' })
  telemetry('controller:dispatch-cli-command -> complete', { functionName: 'dispatch-cli-command', arguments: { action_payload }, phase: 'completed' });
}
