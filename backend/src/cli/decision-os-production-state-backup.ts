/**
 * WHAT: Exposes fixed prepare and verify operations for the complete production-state backup.
 * WHY: Recovery safety needs one noninteractive command with no reset, restore, cleanup, deployment, or path-redirection authority.
 */
import { pathToFileURL } from 'node:url';
import {
  prepareProductionStateBackup,
  ProductionStateBackupError,
  verifyProductionStateBackup,
} from '../business/recovery/helper/production-state-backup.js';

const fixedProductionSettingsFile = '/home/jbb/.decision-os/.settings.json';

type Command = { command: 'prepare' | 'verify'; backupDirectory: string };

function parseArguments(argv: readonly string[]): Command {
  const command = String(argv[0] ?? '');
  // WHAT: Admit only preparation and independent verification.
  // WHY: Reset, reconciliation, restore activation, deletion, and deployment require separate authority.
  if (command !== 'prepare' && command !== 'verify') {
    throw new ProductionStateBackupError('production_state_backup_cli_usage', 'Command must be prepare or verify.');
  }
  const values = new Map<string, string | true>();
  for (let index = 1; index < argv.length; index += 1) {
    const key = String(argv[index] ?? '');
    // WHAT: Reject positional, duplicate, and arbitrary backup options.
    // WHY: The operator may select only one new external destination.
    if (!['--backup-directory', '--json'].includes(key) || values.has(key)) {
      throw new ProductionStateBackupError('production_state_backup_cli_usage', `Unsupported or duplicate option: ${key}.`);
    }
    // WHAT: Record the mandatory machine-readable output flag without consuming a value.
    // WHY: Recovery admission requires one stable receipt.
    if (key === '--json') {
      values.set(key, true);
      continue;
    }
    const value = String(argv[++index] ?? '');
    // WHAT: Require a concrete absolute destination value.
    // WHY: An empty value must not resolve into the production catalog.
    if (!value || value.startsWith('--')) {
      throw new ProductionStateBackupError('production_state_backup_cli_usage', '--backup-directory requires an absolute path.');
    }
    values.set(key, value);
  }
  // WHAT: Require both the destination and JSON receipt contract.
  // WHY: An implicit path or human-only output cannot authorize recovery.
  if (typeof values.get('--backup-directory') !== 'string' || values.get('--json') !== true) {
    throw new ProductionStateBackupError('production_state_backup_cli_usage', '--backup-directory and --json are required.');
  }
  return { command, backupDirectory: String(values.get('--backup-directory')) };
}

export async function runDecisionOsProductionStateBackupCli(input: {
  argv: readonly string[];
  settingsFile?: string;
  write?: (value: string) => void;
}): Promise<number> {
  const parsed = parseArguments(input.argv);
  const manifest = parsed.command === 'prepare'
    ? await prepareProductionStateBackup({
        backupDirectory: parsed.backupDirectory,
        settingsFile: input.settingsFile ?? fixedProductionSettingsFile,
      })
    : await verifyProductionStateBackup({ backupDirectory: parsed.backupDirectory });
  const taskEntityCount = manifest.taskState.reduce((sum, project) => sum + project.entityCount, 0);
  (input.write ?? ((value) => process.stdout.write(value)))(`${JSON.stringify({
    ok: true,
    command: parsed.command,
    backupDirectory: manifest.backupDirectory,
    manifestFile: manifest.manifestFile,
    registryVersion: manifest.registryVersion,
    projectCount: manifest.projectCount,
    directoryCount: manifest.directoryCount,
    fileCount: manifest.fileCount,
    symlinkCount: manifest.symlinkCount,
    byteCount: manifest.byteCount,
    sourceRootHash: manifest.sourceRootHash,
    archiveRootHash: manifest.archiveRootHash,
    restoredRootHash: manifest.restoredRootHash,
    taskEntityCount,
    releaseSha: manifest.release.releaseSha,
    restorationReady: manifest.restoration.ready,
    automaticDeletionPermitted: manifest.retention.automaticDeletionPermitted,
  })}\n`);
  return 0;
}

async function main(): Promise<void> {
  try {
    process.exitCode = await runDecisionOsProductionStateBackupCli({ argv: process.argv.slice(2) });
  } catch (error) {
    const code = error instanceof ProductionStateBackupError ? error.code : 'production_state_backup_failed';
    process.stdout.write(`${JSON.stringify({
      ok: false,
      error: code,
      message: error instanceof Error ? error.message : String(error),
    })}\n`);
    process.exitCode = code === 'production_state_backup_cli_usage' ? 2 : 3;
  }
}

// WHAT: Execute only when this module is the selected CLI entrypoint.
// WHY: Focused tests import the runtime without reading or copying production state.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
