/**
 * WHAT: Commits the versioned Markdown written by one accepted task creation or thread append.
 * WHY: A clean Git worktree provides a second recovery boundary without versioning causal runtime state.
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type { LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import {
  commitAuthoredFileRevision,
  sha256AuthoredBytes,
  type AuthoredFileRevision,
} from '../../content-authoring/helper/authored-file-git-revisions.js';

const committedActions = new Set(['create-card', 'create-task-intake', 'create-master-task', 'append-note']);

function isVersionedTaskMarkdown(decisionOsRoot: string, file: string): boolean {
  const absolute = resolve(file);
  const inner = relative(decisionOsRoot, absolute).split('\\').join('/');
  return Boolean(inner)
    && !inner.startsWith('..')
    && !isAbsolute(inner)
    && (inner.startsWith('cards/') || inner.startsWith('threads/'))
    && inner.endsWith('.md');
}

function mutationIdentity(mutation: LedgerMutation): string {
  return String(mutation.card?.id ?? mutation.cardId ?? mutation.note?.threadId ?? 'task-content');
}

function subject(mutation: LedgerMutation): string {
  if (mutation.action === 'append-note') return `Record thread message ${mutationIdentity(mutation)}`;
  return `Create Decision OS task ${mutationIdentity(mutation)}`;
}

export function taskContentAutoCommitEnabled(settings: unknown): boolean {
  return Boolean(settings && typeof settings === 'object' && !Array.isArray(settings)
    && (settings as Record<string, unknown>).taskContentAutoCommit === true);
}

export async function commitTaskContentMutation(input: {
  enabled: boolean;
  projectId: string;
  projectRoot: string;
  decisionOsRoot: string;
  mutation: LedgerMutation;
  changedContentFiles: readonly string[];
  signal?: AbortSignal;
}): Promise<AuthoredFileRevision | null> {
  if (!input.enabled || !committedActions.has(String(input.mutation.action))) return null;
  const files = [...new Set(input.changedContentFiles.map((file) => resolve(file)))]
    .filter((file) => isVersionedTaskMarkdown(input.decisionOsRoot, file))
    .sort();
  if (files.length === 0) return null;
  for (const file of files) if (!existsSync(file)) throw new Error(`task_content_git_file_missing:${file}`);
  return await commitAuthoredFileRevision({
    repositoryRoot: input.projectRoot,
    ownerId: `task-content:${input.projectId}:${mutationIdentity(input.mutation)}`,
    subject: subject(input.mutation),
    confirmedFiles: files.map((file) => ({ file, contentRevision: sha256AuthoredBytes(readFileSync(file)) })),
    signal: input.signal,
  });
}
