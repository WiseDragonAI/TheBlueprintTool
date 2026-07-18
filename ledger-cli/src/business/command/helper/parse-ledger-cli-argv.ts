/**
 * WHAT: CLI argv parser for ledger-cli commands and file arguments.
 * WHY: ledger command controllers need one normalized action payload from terminal input.
 */
import type { AssetCommand, LedgerCliCommand, LedgerCommand } from '../../../lib/types.js';

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

function trailingValues(args: string[], flag: string): string[] {
  return args.flatMap((arg, index) => {
    if (arg !== flag || index === args.length - 1) {
      return [];
    }

    return [args[index + 1]];
  });
}

function flagNumber(args: string[], flag: string): number | undefined {
  const value = flagValue(args, flag);
  if (value === undefined) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function relationshipValues(args: string[]): Array<{ from: string; id: string; label?: string; to: string }> {
  return trailingValues(args, '--add-relationship').map((value) => {
    const [id = '', from = '', to = '', label] = value.split(':');
    return { id, from, to, label };
  });
}

export function parseLedgerCliArgv(argv: string[]): LedgerCliCommand {
  const [mode] = argv;
  const normalizedMode: LedgerCommand | 'assets' = argv.length === 0 || argv.includes('--help') || argv.includes('-h') || mode === 'help'
    ? 'help'
    : mode === 'assets' ? 'assets'
    : mode === 'answer' || mode === 'card-context' || mode === 'codex-run-audit' || mode === 'codex-run-events' || mode === 'done' || mode === 'execution-profile' || mode === 'export' || mode === 'master-task-apply' || mode === 'master-task-complete' || mode === 'master-task-gate' || mode === 'master-task-progress' || mode === 'migrate-decision-os' || mode === 'migrate-master-tasks' || mode === 'mutate' || mode === 'overview' || mode === 'session-context' || mode === 'skills' || mode === 'todo' || mode === 'unanswered' || mode === 'validate-master-tasks' || mode === 'zone-cards' ? mode : 'inspect';
  const assetAction = (argv[1] === 'apply-gc-plan' || argv[1] === 'gc' || argv[1] === 'list-orphans' || argv[1] === 'list-referenced' || argv[1] === 'prune-json' || argv[1] === 'stage-referenced'
    ? argv[1]
    : 'gc') as AssetCommand;
  return {
    mode: normalizedMode,
    ledgerJsonFile: flagValue(argv, '--ledger') ?? (normalizedMode === 'master-task-complete'
      ? process.env.DECISION_OS_LEDGER_FILE ?? ''
      : argv[1] ?? '../.decision-os/specs.json'),
    answerOperation: {
      message: flagValue(argv, '--message'),
      messageFile: flagValue(argv, '--message-file'),
      messageStdin: argv.includes('--message-stdin'),
      threadId: flagValue(argv, '--thread-id'),
    },
    cardOperation: normalizedMode === 'card-context' || normalizedMode === 'session-context' || normalizedMode === 'master-task-complete' || normalizedMode === 'master-task-gate' || normalizedMode === 'validate-master-tasks'
      ? { cardId: flagValue(argv, '--card-id') }
      : undefined,
    json: argv.includes('--json'),
    exportOperation: {
      outputFile: flagValue(argv, '--output') ?? flagValue(argv, '--out'),
    },
    assetOperation: normalizedMode === 'assets'
      ? {
        action: assetAction,
        domain: flagValue(argv, '--domain'),
        dryRun: argv.includes('--dry-run') || (!flagValue(argv, '--write-plan') && assetAction === 'gc'),
        includeRisky: flagValues(argv, '--include-risky'),
        json: argv.includes('--json'),
        planFile: flagValue(argv, '--plan'),
        root: flagValue(argv, '--root'),
        writePlanFile: flagValue(argv, '--write-plan'),
        write: argv.includes('--write'),
      }
      : undefined,
    mutationFile: flagValue(argv, '--mutation'),
    migrationOperation: normalizedMode === 'migrate-decision-os'
      ? {
        allowDirty: argv.includes('--allow-dirty'),
        dryRun: argv.includes('--dry-run') || !argv.includes('--write'),
        json: argv.includes('--json'),
        root: flagValue(argv, '--root'),
        write: argv.includes('--write'),
      }
      : undefined,
    masterTaskMigrationOperation: normalizedMode === 'migrate-master-tasks'
      ? {
        json: argv.includes('--json'),
        sourceLedger: flagValue(argv, '--source-ledger'),
        targetLedger: flagValue(argv, '--target-ledger'),
        write: argv.includes('--write'),
      }
      : undefined,
    masterTaskOperation: normalizedMode === 'master-task-apply' || normalizedMode === 'master-task-progress'
      ? { planStdin: argv.includes('--plan-stdin') }
      : undefined,
    runAuditOperation: normalizedMode === 'codex-run-audit'
      ? { root: flagValue(argv, '--root'), count: flagNumber(argv, '--count') ?? 10, cutoff: flagNumber(argv, '--cutoff'), exclusions: flagValues(argv, '--exclude') }
      : undefined,
    runEventsOperation: normalizedMode === 'codex-run-events'
      ? { root: flagValue(argv, '--root'), runId: flagValue(argv, '--run-id') ?? '', itemType: flagValue(argv, '--item-type') ?? '', limit: flagNumber(argv, '--limit') }
      : undefined,
    skillOperation: normalizedMode === 'skills'
      ? {
        action: argv[1] === 'update' ? 'update' : 'create',
        json: argv.includes('--json'),
        rootFlagProvided: argv.includes('--root'),
        source: flagValue(argv, '--source'),
      }
      : undefined,
    mutationOperation: {
      addCardFile: flagValue(argv, '--add-card-file'),
      addRelationships: relationshipValues(argv),
      cardLabels: flagValues(argv, '--card-labels'),
      cardId: flagValue(argv, '--card-id'),
      cardComment: flagValue(argv, '--card-comment'),
      cardCommentFile: flagValue(argv, '--card-comment-file'),
      cardH: flagNumber(argv, '--card-h'),
      cardTitle: flagValue(argv, '--card-title'),
      cardW: flagNumber(argv, '--card-w'),
      cardX: flagNumber(argv, '--card-x'),
      cardY: flagNumber(argv, '--card-y'),
      removeCardIds: trailingValues(argv, '--remove-card'),
      removeRelationshipIds: trailingValues(argv, '--remove-relationship'),
    },
    statusOperation: normalizedMode === 'todo' || normalizedMode === 'done'
      ? { cardId: flagValue(argv, '--card-id'), status: normalizedMode }
      : undefined,
    zoneOperation: normalizedMode === 'zone-cards'
      ? { zoneId: flagValue(argv, '--zone-id') }
      : undefined,
  };
}
