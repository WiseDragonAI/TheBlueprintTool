/**
 * WHAT: CLI argv parser for ledger-cli commands and file arguments.
 * WHY: ledger command controllers need one normalized action payload from terminal input.
 */
import type { LedgerCliCommand, LedgerCommand } from '../../../lib/types.js';

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

function relationshipValues(args: string[]): Array<{ from: string; id: string; label?: string; to: string }> {
  return trailingValues(args, '--add-relationship').map((value) => {
    const [id = '', from = '', to = '', label] = value.split(':');
    return { id, from, to, label };
  });
}

export function parseLedgerCliArgv(argv: string[]): LedgerCliCommand {
  const [mode] = argv;
  const normalizedMode: LedgerCommand = mode === 'mutate' || mode === 'overview' ? mode : 'inspect';
  return {
    mode: normalizedMode,
    ledgerJsonFile: flagValue(argv, '--ledger') ?? argv[1] ?? '../.blueprinttool/specs.json',
    mutationFile: flagValue(argv, '--mutation'),
    mutationOperation: {
      addCardFile: flagValue(argv, '--add-card-file'),
      addRelationships: relationshipValues(argv),
      cardLabels: flagValues(argv, '--card-labels'),
      cardId: flagValue(argv, '--card-id'),
      cardCommentFile: flagValue(argv, '--card-comment-file'),
      cardTitle: flagValue(argv, '--card-title'),
      removeCardIds: trailingValues(argv, '--remove-card'),
      removeRelationshipIds: trailingValues(argv, '--remove-relationship'),
    },
  };
}
