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
    : mode === 'answer' || mode === 'done' || mode === 'export' || mode === 'mutate' || mode === 'overview' || mode === 'todo' || mode === 'unanswered' ? mode : 'inspect';
  const assetAction = (argv[1] === 'apply-gc-plan' || argv[1] === 'gc' || argv[1] === 'list-orphans' || argv[1] === 'list-referenced' || argv[1] === 'prune-json' || argv[1] === 'stage-referenced'
    ? argv[1]
    : 'gc') as AssetCommand;
  return {
    mode: normalizedMode,
    ledgerJsonFile: flagValue(argv, '--ledger') ?? argv[1] ?? '../.blueprinttool/specs.json',
    answerOperation: {
      message: flagValue(argv, '--message'),
      messageFile: flagValue(argv, '--message-file'),
      threadId: flagValue(argv, '--thread-id'),
    },
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
  };
}
