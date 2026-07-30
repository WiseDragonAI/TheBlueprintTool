/**
 * WHAT: Creates recoverable focused authored-file commits and reads complete immutable owner history.
 * WHY: Every authored owner needs the same exact-byte, index-safe Git transaction and revision contract.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { runBoundedProcess, type BoundedProcessResult } from '../../process/helper/run-bounded-process.js';
import { createRuntimeIncidentLedger, type RuntimeIncidentLedger } from '../../server/helper/runtime-incident-ledger.js';
import {
  acquireRepositoryMutationLock,
  resolveRepositoryContext,
  type RepositoryContext,
  type RepositoryMutationLock,
} from './repository-mutation-lock.js';

export type AuthoredFileConfirmation = {
  file: string;
  contentRevision: string;
};

export type AuthoredFileRevision = {
  commit: string;
  authoredAt: string;
  authorName: string;
  authorEmail: string;
  committedAt: string;
  committerName: string;
  committerEmail: string;
  subject: string;
  parents: string[];
};

export type AuthoredFileRevisionContent = AuthoredFileRevision & {
  contentRevision: string;
  markdown: string;
  baseMarkdown: string;
  patch: string;
  olderCommit: string | null;
  newerCommit: string | null;
};

export type AuthoredFileRevisionSnapshot = {
  contentRevision: string;
  commit: string;
  olderCommit: string | null;
  baseMarkdown: string;
  markdown: string;
};

export type AuthoredFileRevisionHistoryPage = {
  revisions: AuthoredFileRevision[];
  nextCursor: string | null;
};

export type AuthoredGitFailurePoint =
  | 'read-tree'
  | 'add'
  | 'write-tree'
  | 'commit-tree'
  | 'update-ref'
  | 'index-reconciliation';

export class AuthoredFileGitError extends Error {
  constructor(
    readonly code: 'content_revision_conflict' | 'authored_owner_staged' | 'git_revision_pending_recovery',
    readonly statusCode: number,
    message: string,
    readonly recoveryToken: string | null = null,
    readonly incidentId: string | null = null,
  ) {
    super(message);
    this.name = 'AuthoredFileGitError';
  }
}

type RepositoryOwnerFile = {
  file: string;
  path: string;
  contentRevision: string;
};

type RecoveryRecord = {
  version: 1;
  token: string;
  ownerId: string;
  subject: string;
  repositoryRoot: string;
  files: Array<{ path: string; contentRevision: string }>;
  failurePoint: AuthoredGitFailurePoint;
  headAtAttempt: string;
  generatedCommit: string;
  incidentId: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
};

type GitCommandInput = {
  context: RepositoryContext;
  args: string[];
  operation: string;
  env?: NodeJS.ProcessEnv;
  input?: string | Buffer;
  signal?: AbortSignal;
  maximumOutputBytes?: number;
};

const gitDeadlineMs = 20_000;
const maximumRecoveryRecords = 100;

function contentRevision(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function boundedGitError(result: BoundedProcessResult): string {
  return (result.stderr.trim() || result.stdout.trim() || result.spawnError || result.termination || `exit ${result.exitCode}`).slice(0, 2_000);
}

async function runGit(input: GitCommandInput): Promise<BoundedProcessResult> {
  return await runBoundedProcess({
    command: 'git',
    args: input.args,
    cwd: input.context.root,
    env: { ...process.env, ...(input.env ?? {}) },
    input: input.input,
    deadlineMs: gitDeadlineMs,
    signal: input.signal,
    maximumOutputBytes: input.maximumOutputBytes ?? 4 * 1024 * 1024,
    context: { component: 'authored-file-git-revisions', operation: input.operation },
  });
}

async function requiredGitText(input: GitCommandInput): Promise<string> {
  const result = await runGit(input);
  if (!result.ok) throw new Error(`${input.operation}: ${boundedGitError(result)}`);
  return result.stdout.trim();
}

function isContained(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return inner !== '' && !inner.startsWith('..') && !isAbsolute(inner);
}

function ownerFiles(context: RepositoryContext, confirmations: readonly AuthoredFileConfirmation[]): RepositoryOwnerFile[] {
  if (confirmations.length === 0) throw new Error('At least one confirmed authored file is required.');
  const byPath = new Map<string, RepositoryOwnerFile>();
  for (const confirmation of confirmations) {
    if (!/^[a-f0-9]{64}$/.test(confirmation.contentRevision)) {
      throw new Error('Every authored file requires its confirmed SHA-256 content revision.');
    }
    const file = resolve(confirmation.file);
    if (!isContained(context.root, file)) throw new Error('An authored owner file resolves outside its Git repository.');
    if (!existsSync(file) || !lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) {
      throw new Error('An authored owner file must be a present non-symlink file.');
    }
    const path = relative(context.root, file).split('\\').join('/');
    byPath.set(path, { file, path, contentRevision: confirmation.contentRevision });
  }
  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function revalidateOwnerBytes(files: readonly RepositoryOwnerFile[]): void {
  for (const file of files) {
    const observed = contentRevision(readFileSync(file.file));
    if (observed !== file.contentRevision) {
      throw new AuthoredFileGitError(
        'content_revision_conflict',
        409,
        'The authored owner bytes changed after they were confirmed.',
      );
    }
  }
}

async function stagedOwnerPaths(context: RepositoryContext, paths: readonly string[], signal?: AbortSignal): Promise<string[]> {
  const result = await runGit({
    context,
    args: ['diff', '--cached', '--name-only', 'HEAD', '--', ...paths],
    operation: 'inspect-staged-owner-paths',
    signal,
  });
  if (!result.ok) throw new Error(`inspect-staged-owner-paths: ${boundedGitError(result)}`);
  return result.stdout.trim().split('\n').filter(Boolean);
}

function injectFailure(point: AuthoredGitFailurePoint, requested?: AuthoredGitFailurePoint): void {
  if (point === requested) throw new Error(`Injected Git ${point} failure.`);
}

function recoveryDirectory(context: RepositoryContext): string {
  return resolve(context.commonDirectory, 'decision-os', 'authored-revision-recovery');
}

function recoveryFile(context: RepositoryContext, token: string): string {
  if (!/^[a-f0-9-]{36}$/.test(token)) throw new Error('The authored Git recovery token is invalid.');
  return resolve(recoveryDirectory(context), `${token}.json`);
}

function readRecoveryRecord(file: string): RecoveryRecord {
  const record = JSON.parse(readFileSync(file, 'utf8')) as Partial<RecoveryRecord>;
  if (
    record.version !== 1
    || typeof record.token !== 'string'
    || typeof record.ownerId !== 'string'
    || typeof record.subject !== 'string'
    || typeof record.repositoryRoot !== 'string'
    || !Array.isArray(record.files)
    || typeof record.failurePoint !== 'string'
    || typeof record.headAtAttempt !== 'string'
    || typeof record.generatedCommit !== 'string'
    || typeof record.incidentId !== 'string'
    || !Number.isInteger(record.attempts)
  ) throw new Error('The authored Git recovery record is invalid.');
  return record as RecoveryRecord;
}

function writeRecoveryRecord(context: RepositoryContext, record: RecoveryRecord): void {
  const directory = recoveryDirectory(context);
  mkdirSync(directory, { recursive: true });
  const existing = readdirSync(directory).filter((name) => name.endsWith('.json'));
  if (!existing.includes(`${record.token}.json`) && existing.length >= maximumRecoveryRecords) {
    throw new Error('The authored Git recovery record limit has been reached.');
  }
  const file = recoveryFile(context, record.token);
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporary, file);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function defaultIncidentLedger(context: RepositoryContext): RuntimeIncidentLedger {
  return createRuntimeIncidentLedger({
    decisionOsRoot: resolve(context.commonDirectory, 'decision-os'),
    file: resolve(context.commonDirectory, 'decision-os', 'runtime-incidents.json'),
    maxIncidents: maximumRecoveryRecords,
  });
}

function originalIndex(context: RepositoryContext): { bytes: Buffer | null; revision: string } {
  const bytes = existsSync(context.indexFile) ? readFileSync(context.indexFile) : null;
  return {
    bytes,
    revision: contentRevision(bytes ?? Buffer.alloc(0)),
  };
}

function assertIndexUnchanged(context: RepositoryContext, revision: string): void {
  const observed = existsSync(context.indexFile) ? readFileSync(context.indexFile) : Buffer.alloc(0);
  if (contentRevision(observed) !== revision) {
    throw new Error('The real Git index changed during the authored revision transaction.');
  }
}

async function installCommitEntriesIntoIndex(input: {
  context: RepositoryContext;
  indexSnapshot: Buffer | null;
  indexRevision: string;
  paths: readonly string[];
  priorHead: string;
  newCommit: string;
  temporaryIndex: string;
  signal?: AbortSignal;
  failureAt?: AuthoredGitFailurePoint;
}): Promise<void> {
  if (input.indexSnapshot) writeFileSync(input.temporaryIndex, input.indexSnapshot, { mode: statSync(input.context.indexFile).mode & 0o777 });
  else {
    const initialized = await runGit({
      context: input.context,
      args: ['read-tree', input.priorHead],
      operation: 'initialize-real-index-reconciliation',
      env: { GIT_INDEX_FILE: input.temporaryIndex },
      signal: input.signal,
    });
    if (!initialized.ok) throw new Error(`initialize-real-index-reconciliation: ${boundedGitError(initialized)}`);
  }
  for (const path of input.paths) {
    const entry = await requiredGitText({
      context: input.context,
      args: ['ls-tree', input.newCommit, '--', path],
      operation: 'read-new-index-entry',
      signal: input.signal,
    });
    const match = entry.match(/^([0-7]{6})\s+blob\s+([a-f0-9]{40,64})\t/);
    if (!match) throw new Error(`The new authored commit has no blob for ${path}.`);
    const updated = await runGit({
      context: input.context,
      args: ['update-index', '--add', '--cacheinfo', match[1], match[2], path],
      operation: 'prepare-real-index-reconciliation',
      env: { GIT_INDEX_FILE: input.temporaryIndex },
      signal: input.signal,
    });
    if (!updated.ok) throw new Error(`prepare-real-index-reconciliation: ${boundedGitError(updated)}`);
  }
  injectFailure('index-reconciliation', input.failureAt);
  assertIndexUnchanged(input.context, input.indexRevision);
  const installedBytes = readFileSync(input.temporaryIndex);
  const indexLock = `${input.context.indexFile}.lock`;
  try {
    writeFileSync(indexLock, installedBytes, { flag: 'wx', mode: input.indexSnapshot ? statSync(input.context.indexFile).mode & 0o777 : 0o644 });
    assertIndexUnchanged(input.context, input.indexRevision);
    renameSync(indexLock, input.context.indexFile);
  } catch (error) {
    rmSync(indexLock, { force: true });
    throw error;
  }
}

async function revisionMetadata(context: RepositoryContext, commit: string, signal?: AbortSignal): Promise<AuthoredFileRevision> {
  const raw = await requiredGitText({
    context,
    args: ['show', '-s', '--format=%H%x1f%aI%x1f%an%x1f%ae%x1f%cI%x1f%cn%x1f%ce%x1f%s%x1f%P', commit],
    operation: 'read-revision-metadata',
    signal,
  });
  const [revision, authoredAt, authorName, authorEmail, committedAt, committerName, committerEmail, subject, parents] = raw.split('\x1f');
  return {
    commit: revision,
    authoredAt,
    authorName,
    authorEmail,
    committedAt,
    committerName,
    committerEmail,
    subject: subject ?? '',
    parents: (parents ?? '').split(' ').filter(Boolean),
  };
}

async function rollbackHead(context: RepositoryContext, priorHead: string, newCommit: string, signal?: AbortSignal): Promise<void> {
  const rollback = await runGit({
    context,
    args: ['update-ref', 'HEAD', priorHead, newCommit],
    operation: 'rollback-head',
    signal,
  });
  if (!rollback.ok) throw new Error(`rollback-head: ${boundedGitError(rollback)}`);
}

async function persistRecovery(input: {
  context: RepositoryContext;
  ownerId: string;
  subject: string;
  files: readonly RepositoryOwnerFile[];
  failurePoint: AuthoredGitFailurePoint;
  headAtAttempt: string;
  generatedCommit: string;
  error: unknown;
  incidentLedger?: RuntimeIncidentLedger;
  token?: string;
  priorAttempts?: number;
}): Promise<never> {
  const token = input.token ?? randomUUID();
  const ledger = input.incidentLedger ?? defaultIncidentLedger(input.context);
  const incident = ledger.record({
    scope: `authored-git:${input.ownerId}`,
    component: 'authored-file-git-revisions',
    operation: input.failurePoint,
    code: 'git_revision_pending_recovery',
    error: input.error,
    context: {
      recoveryToken: token,
      ownerId: input.ownerId,
      contentRevisions: input.files.map((file) => file.contentRevision),
      headAtAttempt: input.headAtAttempt,
      generatedCommit: input.generatedCommit,
    },
  });
  const now = new Date().toISOString();
  writeRecoveryRecord(input.context, {
    version: 1,
    token,
    ownerId: input.ownerId,
    subject: input.subject,
    repositoryRoot: input.context.root,
    files: input.files.map((file) => ({ path: file.path, contentRevision: file.contentRevision })),
    failurePoint: input.failurePoint,
    headAtAttempt: input.headAtAttempt,
    generatedCommit: input.generatedCommit,
    incidentId: incident.id,
    createdAt: now,
    updatedAt: now,
    attempts: (input.priorAttempts ?? 0) + 1,
  });
  throw new AuthoredFileGitError(
    'git_revision_pending_recovery',
    503,
    'The authored bytes were preserved, but their Git revision requires explicit retry.',
    token,
    incident.id,
  );
}

async function commitUnderLock(input: {
  lock: RepositoryMutationLock;
  ownerId: string;
  subject: string;
  files: readonly RepositoryOwnerFile[];
  signal?: AbortSignal;
  failureAt?: AuthoredGitFailurePoint;
  incidentLedger?: RuntimeIncidentLedger;
  recoveryToken?: string;
  recoveryAttempts?: number;
  /** Test-only hook at the exact under-lock byte revalidation boundary. */
  beforeRevalidation?: () => void | Promise<void>;
}): Promise<AuthoredFileRevision> {
  const context = input.lock.context;
  const paths = input.files.map((file) => file.path);
  let stage: AuthoredGitFailurePoint = 'read-tree';
  let priorHead = input.lock.owner.head;
  let generatedCommit = '';
  const temporaryRoot = resolve(context.commonDirectory, 'decision-os', 'temporary-indexes');
  mkdirSync(temporaryRoot, { recursive: true });
  const commitIndex = resolve(temporaryRoot, `${randomUUID()}.commit-index`);
  const reconcileIndex = resolve(temporaryRoot, `${randomUUID()}.real-index`);
  const realIndex = originalIndex(context);
  try {
    await input.beforeRevalidation?.();
    revalidateOwnerBytes(input.files);
    const observedHead = await requiredGitText({
      context,
      args: ['rev-parse', 'HEAD'],
      operation: 'revalidate-head',
      signal: input.signal,
    });
    if (observedHead !== priorHead) {
      throw new AuthoredFileGitError('content_revision_conflict', 409, 'Git HEAD changed before the authored revision transaction.');
    }
    const staged = await stagedOwnerPaths(context, paths, input.signal);
    if (staged.length > 0) {
      throw new AuthoredFileGitError('authored_owner_staged', 409, 'A confirmed authored owner path is already staged.');
    }

    stage = 'read-tree';
    injectFailure(stage, input.failureAt);
    const readTree = await runGit({
      context,
      args: ['read-tree', priorHead],
      operation: stage,
      env: { GIT_INDEX_FILE: commitIndex },
      signal: input.signal,
    });
    if (!readTree.ok) throw new Error(`${stage}: ${boundedGitError(readTree)}`);

    stage = 'add';
    injectFailure(stage, input.failureAt);
    const add = await runGit({
      context,
      args: ['add', '--force', '--', ...paths],
      operation: stage,
      env: { GIT_INDEX_FILE: commitIndex },
      signal: input.signal,
    });
    if (!add.ok) throw new Error(`${stage}: ${boundedGitError(add)}`);
    revalidateOwnerBytes(input.files);

    stage = 'write-tree';
    injectFailure(stage, input.failureAt);
    const tree = await requiredGitText({
      context,
      args: ['write-tree'],
      operation: stage,
      env: { GIT_INDEX_FILE: commitIndex },
      signal: input.signal,
    });
    const headTree = await requiredGitText({
      context,
      args: ['rev-parse', `${priorHead}^{tree}`],
      operation: 'read-head-tree',
      signal: input.signal,
    });
    if (tree === headTree) {
      const history = await readAuthoredFileRevisionHistory({
        file: input.files[0].file,
        limit: 1,
        signal: input.signal,
      });
      if (!history.revisions[0]) throw new Error('The authored content is unchanged and has no existing revision.');
      return history.revisions[0];
    }

    stage = 'commit-tree';
    injectFailure(stage, input.failureAt);
    generatedCommit = await requiredGitText({
      context,
      args: ['commit-tree', tree, '-p', priorHead],
      operation: stage,
      env: {
        GIT_INDEX_FILE: commitIndex,
        GIT_AUTHOR_NAME: 'Decision OS',
        GIT_AUTHOR_EMAIL: 'decision-os@localhost',
        GIT_COMMITTER_NAME: 'Decision OS',
        GIT_COMMITTER_EMAIL: 'decision-os@localhost',
      },
      input: [
        input.subject.trim(),
        '',
        'WHAT: Version the confirmed authored files as one focused revision.',
        '',
        'WHY: Decision OS authored content requires exact-byte Git evidence without staging unrelated work.',
        '',
      ].join('\n'),
      signal: input.signal,
    });

    stage = 'update-ref';
    injectFailure(stage, input.failureAt);
    const updateRef = await runGit({
      context,
      args: ['update-ref', 'HEAD', generatedCommit, priorHead],
      operation: stage,
      signal: input.signal,
    });
    if (!updateRef.ok) throw new Error(`${stage}: ${boundedGitError(updateRef)}`);

    stage = 'index-reconciliation';
    try {
      await installCommitEntriesIntoIndex({
        context,
        indexSnapshot: realIndex.bytes,
        indexRevision: realIndex.revision,
        paths,
        priorHead,
        newCommit: generatedCommit,
        temporaryIndex: reconcileIndex,
        signal: input.signal,
        failureAt: input.failureAt,
      });
    } catch (error) {
      await rollbackHead(context, priorHead, generatedCommit, input.signal);
      throw error;
    }
    return await revisionMetadata(context, generatedCommit, input.signal);
  } catch (error) {
    if (error instanceof AuthoredFileGitError && error.code !== 'git_revision_pending_recovery') throw error;
    await persistRecovery({
      context,
      ownerId: input.ownerId,
      subject: input.subject,
      files: input.files,
      failurePoint: stage,
      headAtAttempt: priorHead,
      generatedCommit,
      error,
      incidentLedger: input.incidentLedger,
      token: input.recoveryToken,
      priorAttempts: input.recoveryAttempts,
    });
  } finally {
    rmSync(commitIndex, { force: true });
    rmSync(`${commitIndex}.lock`, { force: true });
    rmSync(reconcileIndex, { force: true });
    rmSync(`${reconcileIndex}.lock`, { force: true });
  }
}

export async function commitAuthoredFileRevision(input: {
  repositoryRoot: string;
  ownerId: string;
  subject: string;
  confirmedFiles: readonly AuthoredFileConfirmation[];
  signal?: AbortSignal;
  incidentLedger?: RuntimeIncidentLedger;
  /** Test-only first-boundary failure injection. */
  failureAt?: AuthoredGitFailurePoint;
  /** Test-only under-lock mutation injection. */
  beforeRevalidation?: () => void | Promise<void>;
}): Promise<AuthoredFileRevision> {
  const lock = await acquireRepositoryMutationLock({
    repositoryRoot: input.repositoryRoot,
    purpose: `authored-revision:${input.ownerId}`,
    signal: input.signal,
  });
  try {
    const files = ownerFiles(lock.context, input.confirmedFiles);
    return await commitUnderLock({
      lock,
      ownerId: input.ownerId,
      subject: input.subject,
      files,
      signal: input.signal,
      failureAt: input.failureAt,
      incidentLedger: input.incidentLedger,
      beforeRevalidation: input.beforeRevalidation,
    });
  } finally {
    lock.release();
  }
}

export async function retryAuthoredFileRevision(input: {
  repositoryRoot: string;
  ownerId: string;
  recoveryToken: string;
  signal?: AbortSignal;
  incidentLedger?: RuntimeIncidentLedger;
  /** Test-only first-boundary failure injection. */
  failureAt?: AuthoredGitFailurePoint;
}): Promise<AuthoredFileRevision> {
  const context = await resolveRepositoryContext(input.repositoryRoot, input.signal);
  const file = recoveryFile(context, input.recoveryToken);
  if (!existsSync(file)) throw new Error('The authored Git recovery record does not exist.');
  const recovery = readRecoveryRecord(file);
  if (recovery.ownerId !== input.ownerId || resolve(recovery.repositoryRoot) !== context.root) {
    throw new Error('The authored Git recovery token does not belong to this owner.');
  }
  const confirmedFiles = recovery.files.map((entry) => ({
    file: resolve(context.root, entry.path),
    contentRevision: entry.contentRevision,
  }));
  const lock = await acquireRepositoryMutationLock({
    repositoryRoot: context.root,
    purpose: `authored-revision-retry:${input.ownerId}`,
    signal: input.signal,
  });
  try {
    const files = ownerFiles(lock.context, confirmedFiles);
    revalidateOwnerBytes(files);
    const revision = await commitUnderLock({
      lock,
      ownerId: input.ownerId,
      subject: recovery.subject,
      files,
      signal: input.signal,
      failureAt: input.failureAt,
      incidentLedger: input.incidentLedger,
      recoveryToken: recovery.token,
      recoveryAttempts: recovery.attempts,
    });
    rmSync(file, { force: true });
    (input.incidentLedger ?? defaultIncidentLedger(context)).resolveScope(
      `authored-git:${input.ownerId}`,
      `Recovered by Git revision ${revision.commit}.`,
    );
    return revision;
  } finally {
    lock.release();
  }
}

type InternalHistoryEntry = AuthoredFileRevision & { path: string };

function parseHistory(raw: string): InternalHistoryEntry[] {
  return raw.split('\x1e').flatMap((block) => {
    const lines = block.split('\n').filter((line) => line.length > 0);
    if (lines.length === 0) return [];
    const [commit, authoredAt, authorName, authorEmail, committedAt, committerName, committerEmail, subject, parents] = lines[0].split('\x1f');
    if (!/^[a-f0-9]{40,64}$/.test(commit ?? '')) return [];
    let path = '';
    for (const line of lines.slice(1)) {
      const fields = line.split('\t');
      if (/^[RC]\d*$/.test(fields[0] ?? '') && fields[2]) path = fields[2];
      else if (fields[1]) path = fields[1];
    }
    if (!path) return [];
    return [{
      commit,
      authoredAt,
      authorName,
      authorEmail,
      committedAt,
      committerName,
      committerEmail,
      subject: subject ?? '',
      parents: (parents ?? '').split(' ').filter(Boolean),
      path,
    }];
  });
}

function encodeCursor(commit: string): string {
  return Buffer.from(JSON.stringify({ after: commit }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): string {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { after?: unknown };
    if (typeof value.after !== 'string' || !/^[a-f0-9]{40,64}$/.test(value.after)) throw new Error();
    return value.after;
  } catch {
    throw new Error('The authored revision history cursor is invalid.');
  }
}

async function completeHistory(file: string, signal?: AbortSignal): Promise<{ context: RepositoryContext; entries: InternalHistoryEntry[] }> {
  const context = await resolveRepositoryContext(resolve(file, '..'), signal);
  const absoluteFile = resolve(file);
  if (!isContained(context.root, absoluteFile)) throw new Error('The authored file resolves outside its Git repository.');
  const path = relative(context.root, absoluteFile).split('\\').join('/');
  const result = await runGit({
    context,
    args: [
      'log',
      '--follow',
      '--name-status',
      '-M',
      '--format=%x1e%H%x1f%aI%x1f%an%x1f%ae%x1f%cI%x1f%cn%x1f%ce%x1f%s%x1f%P',
      '--',
      path,
    ],
    operation: 'read-complete-history',
    signal,
    maximumOutputBytes: 16 * 1024 * 1024,
  });
  if (!result.ok) throw new Error(`read-complete-history: ${boundedGitError(result)}`);
  if (result.stdoutTruncatedBytes > 0) throw new Error('The authored revision history exceeds the bounded Git output artifact.');
  return { context, entries: parseHistory(result.stdout) };
}

export async function readAuthoredFileRevisionHistory(input: {
  file: string;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<AuthoredFileRevisionHistoryPage> {
  const { entries } = await completeHistory(input.file, input.signal);
  const limit = Math.max(1, Math.min(200, Math.floor(input.limit ?? 100)));
  let offset = 0;
  if (input.cursor) {
    const after = decodeCursor(input.cursor);
    const index = entries.findIndex((entry) => entry.commit === after);
    if (index < 0) throw new Error('The authored revision history cursor is stale.');
    offset = index + 1;
  }
  const selected = entries.slice(offset, offset + limit);
  const nextCursor = offset + selected.length < entries.length && selected.length > 0
    ? encodeCursor(selected[selected.length - 1].commit)
    : null;
  return {
    revisions: selected.map(({ path: _path, ...revision }) => revision),
    nextCursor,
  };
}

async function immutableContent(context: RepositoryContext, entry: InternalHistoryEntry, signal?: AbortSignal): Promise<string> {
  const result = await runGit({
    context,
    args: ['show', `${entry.commit}:${entry.path}`],
    operation: 'read-immutable-content',
    signal,
    maximumOutputBytes: 2 * 1024 * 1024,
  });
  if (!result.ok || result.stdoutTruncatedBytes > 0) {
    throw new Error(`read-immutable-content: ${boundedGitError(result)}`);
  }
  return result.stdout;
}

export async function readAuthoredFileRevisionContent(input: {
  file: string;
  commit: string;
  signal?: AbortSignal;
}): Promise<AuthoredFileRevisionContent> {
  const { context, entries } = await completeHistory(input.file, input.signal);
  const index = entries.findIndex((entry) => entry.commit === input.commit);
  if (index < 0) throw new Error('The requested commit is not present in this authored owner history.');
  const selected = entries[index];
  const older = entries[index + 1] ?? null;
  const newer = entries[index - 1] ?? null;
  const selectedBlob = await requiredGitText({
    context,
    args: ['rev-parse', `${selected.commit}:${selected.path}`],
    operation: 'read-selected-blob',
    signal: input.signal,
  });
  const olderBlob = older
    ? await requiredGitText({
        context,
        args: ['rev-parse', `${older.commit}:${older.path}`],
        operation: 'read-older-blob',
        signal: input.signal,
      })
    : null;
  const patchResult = await runGit({
    context,
    args: olderBlob
      ? ['diff', '--no-ext-diff', '--unified=3', olderBlob, selectedBlob]
      : ['diff-tree', '--root', '--no-commit-id', '--patch', '--no-ext-diff', '--unified=3', selected.commit, '--', selected.path],
    operation: 'read-older-to-selected-diff',
    signal: input.signal,
    maximumOutputBytes: 4 * 1024 * 1024,
  });
  if (!patchResult.ok || patchResult.stdoutTruncatedBytes > 0) {
    throw new Error(`read-older-to-selected-diff: ${boundedGitError(patchResult)}`);
  }
  const { path: _path, ...revision } = selected;
  const markdown = await immutableContent(context, selected, input.signal);
  const baseMarkdown = older
    ? await immutableContent(context, older, input.signal)
    : '';
  return {
    ...revision,
    contentRevision: sha256AuthoredBytes(markdown),
    markdown,
    baseMarkdown,
    patch: patchResult.stdout,
    olderCommit: older?.commit ?? null,
    newerCommit: newer?.commit ?? null,
  };
}

export async function readCurrentAuthoredFileRevisionContent(input: {
  file: string;
  signal?: AbortSignal;
}): Promise<AuthoredFileRevisionSnapshot> {
  const { context, entries } = await completeHistory(input.file, input.signal);
  const selected = entries[0];
  if (!selected) throw new Error('The authored owner has no committed revision history.');
  const older = entries[1] ?? null;
  const markdown = readFileSync(resolve(input.file), 'utf8');
  return {
    contentRevision: sha256AuthoredBytes(markdown),
    commit: selected.commit,
    olderCommit: older?.commit ?? null,
    baseMarkdown: older ? await immutableContent(context, older, input.signal) : '',
    markdown,
  };
}

export function sha256AuthoredBytes(bytes: string | Buffer): string {
  return contentRevision(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8'));
}
