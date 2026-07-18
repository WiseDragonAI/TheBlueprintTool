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
import { manageDecisionOsMigrationController } from '../../migration/controller/manage-decision-os-migration.js';
import { applyMasterTaskPlan } from '../../ledger/helper/apply-master-task-plan.js';
import { applyMasterTaskProgress } from '../../ledger/helper/apply-master-task-progress.js';
import { auditCodexRuns } from '../../ledger/helper/audit-codex-runs.js';
import { resolveCodexRunEvents } from '../../ledger/helper/resolve-codex-run-events.js';
import { completeMasterTask } from '../../ledger/helper/complete-master-task.js';
import { synchronizeServerSkillController } from '../../skills/controller/synchronize-server-skill.js';
import { migrateMasterTasks } from '../../ledger/helper/migrate-master-tasks.js';

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

  if (command.mode === 'migrate-decision-os') {
    const result = await manageDecisionOsMigrationController(command.migrationOperation);
    if (result.ok) {
      const output = command.migrationOperation?.json ? JSON.stringify(result.value, null, 2) : [
        `decision-os migration ${result.value.dryRun ? 'dry run' : 'write'} for ${result.value.root}`,
        `Moved directories: ${result.value.movedDirectories.length}`,
        `Changed files: ${result.value.changedFiles.length}`,
        `Skipped binary files: ${result.value.skippedBinaryFiles.length}`,
        `Manual follow-up files: ${result.value.manualFollowUpFiles.length}`,
        ...result.value.manualFollowUpFiles.map((path) => `  ${path}`),
      ].join('\n');
      ports.emit ? ports.emit(output) : console.log(output);
    }
    return result;
  }

  if (command.mode === 'migrate-master-tasks') {
    const operation = command.masterTaskMigrationOperation;
    if (!operation?.sourceLedger || !operation.targetLedger) {
      return { ok: false, error: 'migrate-master-tasks requires --source-ledger and --target-ledger.' };
    }
    const result = migrateMasterTasks({
      sourceLedger: operation.sourceLedger,
      targetLedger: operation.targetLedger,
      write: operation.write,
    });
    if (result.ok) {
      const output = operation.json ? JSON.stringify(result.value, null, 2) : [
        `Master-task migration ${operation.write ? 'written' : 'dry run'}.`,
        `Cards: ${result.value.cards}`,
        `Zones: ${result.value.zones}`,
        `Relationships: ${result.value.relationships}`,
        `Card files: ${result.value.cardFiles}`,
        `Thread files: ${result.value.threadFiles}`,
      ].join('\n');
      ports.emit ? ports.emit(output) : console.log(output);
    }
    return result;
  }

  if (command.mode === 'answer' && command.answerOperation?.messageStdin) {
    let message = '';
    for await (const chunk of process.stdin) message += String(chunk);
    command.answerOperation.message = message;
  }

  if (command.mode === 'master-task-apply') {
    if (!command.masterTaskOperation?.planStdin) return { ok: false, error: 'master-task-apply requires --plan-stdin.' };
    let planJson = '';
    for await (const chunk of process.stdin) planJson += String(chunk);
    const result = applyMasterTaskPlan({ ledgerJsonFile: command.ledgerJsonFile, planJson });
    if (result.ok) ports.emit ? ports.emit(result.value) : console.log(result.value);
    return result;
  }

  if (command.mode === 'master-task-progress') {
    if (!command.masterTaskOperation?.planStdin) return { ok: false, error: 'master-task-progress requires --plan-stdin.' };
    let planJson = '';
    for await (const chunk of process.stdin) planJson += String(chunk);
    const result = applyMasterTaskProgress({ ledgerJsonFile: command.ledgerJsonFile, planJson });
    if (result.ok) ports.emit ? ports.emit(result.value) : console.log(result.value);
    return result;
  }

  if (command.mode === 'master-task-complete') {
    const result = await completeMasterTask({ cardId: command.cardOperation?.cardId, ledgerJsonFile: command.ledgerJsonFile });
    if (result.ok) ports.emit ? ports.emit(result.value) : console.log(result.value);
    return result;
  }

  if (command.mode === 'codex-run-audit') {
    const result = auditCodexRuns(command.runAuditOperation ?? { count: 10, exclusions: [] });
    if (result.ok) ports.emit ? ports.emit(result.value) : console.log(result.value);
    return result;
  }

  if (command.mode === 'codex-run-events') {
    const operation = command.runEventsOperation;
    if (!operation?.runId || !operation.itemType) return { ok: false, error: 'codex-run-events requires --run-id and --item-type.' };
    const result = resolveCodexRunEvents(operation);
    if (result.ok) ports.emit ? ports.emit(result.value) : console.log(result.value);
    return result;
  }

  if (command.mode === 'skills') {
    const result = await synchronizeServerSkillController(command.skillOperation);
    if (result.ok) {
      const output = command.skillOperation?.json
        ? JSON.stringify(result.value, null, 2)
        : `${result.value.operation}d server skill ${result.value.skillName} in ${result.value.commitSha}`;
      ports.emit ? ports.emit(output) : console.log(output);
    }
    return result;
  }

  const result = await manageLedgerJsonController({
    answerOperation: command.answerOperation,
    cardOperation: command.cardOperation,
    exportOperation: command.exportOperation,
    json: command.json,
    ledgerCommand: command.mode,
    ledgerJsonFile: command.ledgerJsonFile,
    mutationFile: command.mutationFile,
    mutationOperation: command.mutationOperation,
    statusOperation: command.statusOperation,
    zoneOperation: command.zoneOperation,
  }, ports.fs);
  if (result.ok && (command.mode === 'answer' || command.mode === 'card-context' || command.mode === 'execution-profile' || command.mode === 'export' || command.mode === 'master-task-gate' || command.mode === 'overview' || command.mode === 'session-context' || command.mode === 'unanswered' || command.mode === 'validate-master-tasks' || command.mode === 'zone-cards') && typeof result.value === 'string') {
    ports.emit ? ports.emit(result.value) : console.log(result.value);
  }
  return result;
}
