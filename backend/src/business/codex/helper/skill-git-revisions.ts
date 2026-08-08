/**
 * WHAT: Adapts skill and prompt owners to the generic asynchronous authored-file Git substrate.
 * WHY: Codex authoring must share the same bounded lock, recovery, and complete history behavior as cards.
 */
import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';
import {
  AuthoredFileGitError,
  commitAuthoredFileRevision,
  readAuthoredFileRevisionContent,
  readAuthoredFileRevisionHistory,
  retryAuthoredFileRevision,
  type AuthoredFileConfirmation,
  type AuthoredFileRevision,
  type AuthoredFileRevisionHistoryPage,
  type AuthoredGitFailurePoint,
} from '../../content-authoring/helper/authored-file-git-revisions.js';
import { acquireRepositoryMutationLock } from '../../content-authoring/helper/repository-mutation-lock.js';
import { runBoundedProcess } from '../../process/helper/run-bounded-process.js';

export type SkillGitRevision = AuthoredFileRevision;

export type SkillGitRevisionDetail = SkillGitRevision & {
  markdown: string;
  patch: string;
  parentCommit: string | null;
  successorCommit: string | null;
};

export type SkillGitHistoryPage = AuthoredFileRevisionHistoryPage;
export type SkillGitFailurePoint = AuthoredGitFailurePoint | 'commit';

function ownerId(file: string): string {
  return `codex-content:${createHash('sha256').update(resolve(file)).digest('hex')}`;
}

function failurePoint(point?: SkillGitFailurePoint): AuthoredGitFailurePoint | undefined {
  return point === 'commit' ? 'commit-tree' : point;
}

export async function assertSkillFileRevisionWritable(input: {
  file: string;
  additionalFiles?: readonly string[];
  repositoryRoot?: string;
  signal?: AbortSignal;
}): Promise<void> {
  const repositoryRoot = resolve(input.repositoryRoot ?? resolve(input.file, '..'));
  const lock = await acquireRepositoryMutationLock({
    repositoryRoot,
    purpose: `authored-save-admission:${ownerId(input.file)}`,
    signal: input.signal,
  });
  try {
    const paths = [...new Set([input.file, ...(input.additionalFiles ?? [])])]
      .map((file) => relative(lock.context.root, resolve(file)).split('\\').join('/'));
    const result = await runBoundedProcess({
      command: 'git',
      args: ['diff', '--cached', '--name-only', 'HEAD', '--', ...paths],
      cwd: lock.context.root,
      deadlineMs: 20_000,
      signal: input.signal,
      maximumOutputBytes: 1024 * 1024,
      context: { component: 'skill-git-revisions', operation: 'inspect-staged-owner-paths' },
    });
    if (!result.ok) throw new Error('Could not inspect the staged authored paths.');
    if (result.stdout.trim()) {
      throw new AuthoredFileGitError('authored_owner_staged', 409, 'A confirmed authored owner path is already staged.');
    }
  } finally {
    lock.release();
  }
}

export async function commitSkillFileRevision(input: {
  file: string;
  contentRevision: string;
  additionalFiles?: readonly AuthoredFileConfirmation[];
  subject: string;
  signal?: AbortSignal;
  /** Test-only first-boundary failure injection. Route callers never populate this field. */
  failureAt?: SkillGitFailurePoint;
  /** Test-only exact-byte race injection. Route callers never populate this field. */
  beforeRevalidation?: () => void | Promise<void>;
}): Promise<SkillGitRevision> {
  const confirmedFiles = new Map<string, AuthoredFileConfirmation>();
  for (const confirmation of [
    { file: input.file, contentRevision: input.contentRevision },
    ...(input.additionalFiles ?? []),
  ]) {
    const file = resolve(confirmation.file);
    confirmedFiles.set(file, { file, contentRevision: confirmation.contentRevision });
  }
  return await commitAuthoredFileRevision({
    repositoryRoot: resolve(input.file, '..'),
    ownerId: ownerId(input.file),
    subject: input.subject,
    confirmedFiles: [...confirmedFiles.values()],
    signal: input.signal,
    failureAt: failurePoint(input.failureAt),
    beforeRevalidation: input.beforeRevalidation,
  });
}

export async function retrySkillFileRevision(input: {
  file: string;
  recoveryToken: string;
  signal?: AbortSignal;
  /** Test-only first-boundary failure injection. Route callers never populate this field. */
  failureAt?: SkillGitFailurePoint;
}): Promise<SkillGitRevision> {
  return await retryAuthoredFileRevision({
    repositoryRoot: resolve(input.file, '..'),
    ownerId: ownerId(input.file),
    recoveryToken: input.recoveryToken,
    signal: input.signal,
    failureAt: failurePoint(input.failureAt),
  });
}

export async function readSkillGitHistoryPage(input: {
  file: string;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<SkillGitHistoryPage> {
  return await readAuthoredFileRevisionHistory(input);
}

/** Compatibility adapter for owner code that only needs the first page. */
export async function readSkillGitHistory(file: string, limit = 100, signal?: AbortSignal): Promise<SkillGitRevision[]> {
  const page = await readAuthoredFileRevisionHistory({ file, limit, signal });
  return page.revisions;
}

export async function readSkillGitRevision(file: string, commit: string, signal?: AbortSignal): Promise<SkillGitRevisionDetail> {
  const revision = await readAuthoredFileRevisionContent({ file, commit, signal });
  const { olderCommit, newerCommit, ...detail } = revision;
  return {
    ...detail,
    parentCommit: olderCommit,
    successorCommit: newerCommit,
  };
}
