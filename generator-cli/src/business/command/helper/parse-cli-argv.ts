/**
 * WHAT: CLI argv parser for generator-cli modes and file arguments.
 * WHY: command controllers need one normalized action payload from terminal input.
 */
import type { CliCommand } from '../../../lib/types.js';

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  // WHY: missing flags should fall back to command defaults instead of crashing.
  // WHAT: return undefined when the flag or its value is absent.
  if (index === -1 || index === args.length - 1) {
    return undefined;
  }

  return args[index + 1];
}

function flagValues(args: string[], flag: string): string[] {
  return args.flatMap((arg, index) => {
    // WHY: only exact flag matches own the following argument.
    // WHAT: ignore unrelated argv entries.
    if (arg !== flag || index === args.length - 1) {
      return [];
    }

    return args[index + 1].split(',').map((value) => value.trim()).filter(Boolean);
  });
}

export function parseCliArgv(argv: string[]): CliCommand {
  const [mode, subcommand] = argv;
  const masterLedgerFile = flagValue(argv, '--master-ledger') ?? '../tmp/master-ledger-generator-cli-26-05-11-1.md';
  const specsLedgerFile = flagValue(argv, '--specs-ledger') ?? '../documentation/specs.json';
  const output = flagValue(argv, '--output') ?? `../.worktrees/generated-${Date.now()}`;

  // WHY: dry-run and apply share the MasterLedger and generated output arguments.
  // WHAT: return the generation command payload for those modes.
  if (mode === 'dry-run' || mode === 'apply') {
    return { mode, masterLedgerFile, specsLedgerFile, output };
  }

  // WHY: check-ledger must inspect MasterLedger structure without generating files.
  // WHAT: return the check command payload and output mode.
  if (mode === 'check-ledger' || mode === 'check') {
    return {
      mode: 'check-ledger',
      masterLedgerFile,
      specsLedgerFile,
      groups: flagValues(argv, '--group'),
      json: argv.includes('--json'),
    };
  }

  // WHY: report mode is process-driven and writes one report file.
  // WHAT: return the node:test command, report path, and optional evidence paths.
  if (mode === 'report') {
    return {
      mode,
      testCommand: flagValue(argv, '--test-command') ?? 'npm test',
      reportFile: flagValue(argv, '--report') ?? 'generated-report.json',
      telemetryFile: flagValue(argv, '--telemetry'),
      functionsFile: flagValue(argv, '--functions'),
    };
  }

  // WHY: patch-doc mode consumes a canonical patch batch file.
  // WHAT: return the patch batch payload.
  if (mode === 'patch-doc') {
    return {
      mode,
      patchBatchFile: flagValue(argv, '--patch-batch') ?? subcommand ?? 'patch-batch.json',
    };
  }

  throw new Error(`Unsupported generator-cli mode: ${mode ?? '(missing)'}`);
}
