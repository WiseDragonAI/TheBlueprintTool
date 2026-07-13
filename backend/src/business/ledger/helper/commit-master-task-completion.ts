/**
 * WHAT: Persists and Git-commits one completed master-task projection.
 * WHY: Completion must leave the canonical ledger, cards, and thread in one scoped commit without consuming unrelated workspace changes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { applyLedgerMutation, type LedgerMutation } from './apply-ledger-mutation.js';
import { readCardDescription } from './card-content-file.js';
import { stripHydratedThreadNotes } from './thread-content-file.js';

type AnyRecord = Record<string, unknown>;
type Ledger = AnyRecord & {
  cards?: AnyRecord[];
  threadFiles?: Record<string, string>;
};
type MutationError = { statusCode: number; body: AnyRecord };

function git(root: string, args: string[], input?: string): string {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    input,
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function cardContentPath(decisionOsRoot: string, card: AnyRecord): string {
  const comment = card.comment && typeof card.comment === 'object' && !Array.isArray(card.comment)
    ? card.comment as AnyRecord
    : {};
  const contentFile = String(comment.contentFile ?? '').trim();
  if (!contentFile) throw new Error(`Card ${String(card.id ?? '')} has no canonical content file.`);
  return resolve(dirname(decisionOsRoot), contentFile);
}

function requireRepositoryPath(repositoryRoot: string, file: string): string {
  const path = relative(repositoryRoot, file);
  if (!path || path.startsWith('..') || isAbsolute(path)) throw new Error(`Completion path is outside the Git repository: ${file}`);
  return path;
}

function replaceLedger(target: Ledger, snapshot: Ledger): void {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, JSON.parse(JSON.stringify(snapshot)) as Ledger);
}

export function commitMasterTaskCompletion(input: {
  decisionOsRoot: string;
  ledgerPath: string;
  ledger: Ledger;
  mutation: LedgerMutation;
}): { ok: true; ledger: Ledger; commitSha: string } | { ok: false; error: MutationError } {
  const masterTaskId = String(input.mutation.masterTaskId ?? '');
  const masterTask = (input.ledger.cards ?? []).find((card) => String(card.id ?? '') === masterTaskId);
  if (!masterTask) return { ok: false, error: { statusCode: 404, body: { ok: false, error: 'Master task not found.' } } };

  const ledgerSnapshot = JSON.parse(JSON.stringify(input.ledger)) as Ledger;
  const ledgerText = readFileSync(input.ledgerPath, 'utf8');
  const masterMarkdown = readCardDescription({ decisionOsRoot: input.decisionOsRoot, card: masterTask });
  const subtaskIds = Array.from(
    masterMarkdown.matchAll(/^\s*\d+[.)]\s+\[[^\]]+\]\(card:([^)]+)\)(?:\s+[—-]\s+Status:\s*.*?)?\s*$/gim),
    (match) => match[1].trim(),
  );
  const cardIds = [masterTaskId, ...subtaskIds];
  const cards = cardIds.map((cardId) => (input.ledger.cards ?? []).find((card) => String(card.id ?? '') === cardId));
  if (cards.some((card) => !card)) {
    return { ok: false, error: { statusCode: 400, body: { ok: false, error: 'Every canonical subtask link must resolve to a ledger card.' } } };
  }
  const masterPath = cardContentPath(input.decisionOsRoot, masterTask);
  const masterText = existsSync(masterPath) ? readFileSync(masterPath, 'utf8') : null;
  let repositoryRoot = '';
  let repositoryPaths: string[] = [];
  let cachedPatch = '';
  let indexTouched = false;

  const restore = (): string => {
    writeFileSync(input.ledgerPath, ledgerText, 'utf8');
    if (masterText === null) rmSync(masterPath, { force: true });
    else writeFileSync(masterPath, masterText, 'utf8');
    replaceLedger(input.ledger, ledgerSnapshot);
    if (!indexTouched || !repositoryRoot || repositoryPaths.length === 0) return '';
    try {
      git(repositoryRoot, ['reset', '--quiet', 'HEAD', '--', ...repositoryPaths]);
      if (cachedPatch) git(repositoryRoot, ['apply', '--cached', '--binary', '--whitespace=nowarn', '-'], cachedPatch);
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : 'Git index restoration failed.';
    }
  };

  try {
    const mutationResult = applyLedgerMutation(input);
    if (mutationResult.error) {
      replaceLedger(input.ledger, ledgerSnapshot);
      return { ok: false, error: mutationResult.error };
    }
    stripHydratedThreadNotes(input.ledger);
    writeFileSync(input.ledgerPath, JSON.stringify(input.ledger, null, 2), 'utf8');

    repositoryRoot = git(dirname(input.decisionOsRoot), ['rev-parse', '--show-toplevel']);
    const threadId = `thread-${masterTaskId}`;
    const threadRef = String(input.ledger.threadFiles?.[threadId] ?? '').trim();
    if (!threadRef) throw new Error(`Master task ${masterTaskId} has no canonical thread file.`);
    const files = [
      input.ledgerPath,
      ...cards.map((card) => cardContentPath(input.decisionOsRoot, card!)),
      resolve(dirname(input.decisionOsRoot), threadRef),
    ];
    if (files.some((file) => !existsSync(file))) throw new Error('A canonical completion file does not exist.');
    repositoryPaths = [...new Set(files.map((file) => requireRepositoryPath(repositoryRoot, file)))];
    cachedPatch = git(repositoryRoot, ['diff', '--cached', '--binary', '--full-index', '--', ...repositoryPaths]);
    indexTouched = true;
    git(repositoryRoot, ['add', '--', ...repositoryPaths]);
    const title = String(masterTask.title ?? masterTaskId).trim() || masterTaskId;
    git(repositoryRoot, ['commit', '--only', '-m', `decision-os: complete ${title}`, '--', ...repositoryPaths]);
    const commitSha = git(repositoryRoot, ['rev-parse', 'HEAD']);
    return { ok: true, ledger: input.ledger, commitSha };
  } catch (error) {
    const rollbackError = restore();
    const failure = error instanceof Error ? error.message : 'Master task completion commit failed.';
    const message = rollbackError ? `${failure} Rollback error: ${rollbackError}` : failure;
    return { ok: false, error: { statusCode: 409, body: { ok: false, error: message } } };
  }
}
