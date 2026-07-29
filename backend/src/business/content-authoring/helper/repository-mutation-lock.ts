/**
 * WHAT: Serializes repository mutations through one Git-common-directory lock.
 * WHY: Authored commits and delivery promotion must not race across linked worktrees.
 */
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { runBoundedProcess } from '../../process/helper/run-bounded-process.js';

export type RepositoryMutationLockOwner = {
  version: 1;
  token: string;
  pid: number;
  processIdentity: string;
  purpose: string;
  head: string;
  acquiredAt: string;
};

export type RepositoryContext = {
  root: string;
  gitDirectory: string;
  commonDirectory: string;
  indexFile: string;
};

export class RepositoryMutationLockError extends Error {
  readonly code = 'repository_mutation_locked';
  readonly statusCode = 423;

  constructor(readonly owner: RepositoryMutationLockOwner | null) {
    super('The Git repository is locked by another Decision OS mutation.');
    this.name = 'RepositoryMutationLockError';
  }
}

export type RepositoryMutationLock = {
  context: RepositoryContext;
  owner: RepositoryMutationLockOwner;
  lockDirectory: string;
  release(): void;
};

export function repositoryMutationProcessIdentity(pid: number): string {
  if (process.platform === 'linux') {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      const closing = stat.lastIndexOf(')');
      const fields = stat.slice(closing + 2).split(' ');
      const startTicks = fields[19] ?? '';
      if (startTicks) return `linux:${pid}:${startTicks}`;
    } catch {
      return '';
    }
  }
  return `pid:${pid}`;
}

export function repositoryMutationOwnerProcessIsActive(owner: Pick<RepositoryMutationLockOwner, 'pid' | 'processIdentity'>): boolean {
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return false;
    if (code !== 'EPERM') return false;
  }
  const observedIdentity = repositoryMutationProcessIdentity(owner.pid);
  return !owner.processIdentity || !observedIdentity || owner.processIdentity === observedIdentity;
}

function isContained(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return inner === '' || (!inner.startsWith('..') && !isAbsolute(inner));
}

async function gitText(input: {
  cwd: string;
  args: string[];
  signal?: AbortSignal;
  operation: string;
}): Promise<string> {
  const result = await runBoundedProcess({
    command: 'git',
    args: input.args,
    cwd: input.cwd,
    deadlineMs: 20_000,
    signal: input.signal,
    maximumOutputBytes: 1024 * 1024,
    context: { component: 'repository-mutation-lock', operation: input.operation },
  });
  if (!result.ok) {
    const detail = result.stderr.trim() || result.stdout.trim() || result.spawnError || result.termination || `exit ${result.exitCode}`;
    throw new Error(`Git ${input.operation} failed: ${detail}.`);
  }
  return result.stdout.trim();
}

export async function resolveRepositoryContext(cwd: string, signal?: AbortSignal): Promise<RepositoryContext> {
  const root = resolve(await gitText({ cwd, args: ['rev-parse', '--show-toplevel'], signal, operation: 'resolve-root' }));
  const gitDirectory = resolve(await gitText({ cwd: root, args: ['rev-parse', '--absolute-git-dir'], signal, operation: 'resolve-git-directory' }));
  const commonDirectory = resolve(await gitText({
    cwd: root,
    args: ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    signal,
    operation: 'resolve-common-directory',
  }));
  const indexFile = resolve(await gitText({
    cwd: root,
    args: ['rev-parse', '--path-format=absolute', '--git-path', 'index'],
    signal,
    operation: 'resolve-index',
  }));
  if (!isContained(commonDirectory, gitDirectory) && commonDirectory !== gitDirectory) {
    throw new Error('The Git worktree metadata does not belong to its common directory.');
  }
  return { root, gitDirectory, commonDirectory, indexFile };
}

function readOwner(file: string): RepositoryMutationLockOwner | null {
  try {
    const value = JSON.parse(readFileSync(file, 'utf8')) as Partial<RepositoryMutationLockOwner>;
    if (
      value.version !== 1
      || typeof value.token !== 'string'
      || !Number.isInteger(value.pid)
      || typeof value.processIdentity !== 'string'
      || typeof value.purpose !== 'string'
      || !/^[a-f0-9]{40,64}$/.test(value.head ?? '')
      || typeof value.acquiredAt !== 'string'
    ) return null;
    return value as RepositoryMutationLockOwner;
  } catch {
    return null;
  }
}

function activeGitState(context: RepositoryContext): string[] {
  const exact = [
    resolve(dirname(context.indexFile), `${context.indexFile.split('/').pop()}.lock`),
    resolve(context.gitDirectory, 'HEAD.lock'),
    resolve(context.commonDirectory, 'packed-refs.lock'),
    resolve(context.gitDirectory, 'MERGE_HEAD'),
    resolve(context.gitDirectory, 'CHERRY_PICK_HEAD'),
    resolve(context.gitDirectory, 'REVERT_HEAD'),
    resolve(context.gitDirectory, 'BISECT_LOG'),
    resolve(context.gitDirectory, 'rebase-apply'),
    resolve(context.gitDirectory, 'rebase-merge'),
  ];
  const active = exact.filter(existsSync);
  const refs = resolve(context.commonDirectory, 'refs');
  if (existsSync(refs)) {
    const pending = [refs];
    while (pending.length > 0) {
      const directory = pending.pop()!;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = resolve(directory, entry.name);
        if (entry.isDirectory()) pending.push(file);
        else if (entry.name.endsWith('.lock')) active.push(file);
      }
    }
  }
  return active;
}

async function reconcileStaleLock(input: {
  context: RepositoryContext;
  lockDirectory: string;
  owner: RepositoryMutationLockOwner | null;
  signal?: AbortSignal;
  authorizeChangedHeadRecovery?: (input: {
    owner: RepositoryMutationLockOwner;
    context: RepositoryContext;
    currentHead: string;
  }) => boolean | Promise<boolean>;
}): Promise<boolean> {
  if (!input.owner || repositoryMutationOwnerProcessIsActive(input.owner)) return false;
  if (activeGitState(input.context).length > 0) return false;
  const head = await gitText({
    cwd: input.context.root,
    args: ['rev-parse', 'HEAD'],
    signal: input.signal,
    operation: 'reconcile-stale-lock-head',
  });
  if (
    head !== input.owner.head
    && !await input.authorizeChangedHeadRecovery?.({
      owner: input.owner,
      context: input.context,
      currentHead: head,
    })
  ) return false;
  if (!isContained(resolve(input.context.commonDirectory, 'decision-os'), input.lockDirectory)) return false;
  rmSync(input.lockDirectory, { recursive: true, force: true });
  return true;
}

export async function acquireRepositoryMutationLock(input: {
  repositoryRoot: string;
  purpose: string;
  signal?: AbortSignal;
  authorizeChangedHeadRecovery?: (input: {
    owner: RepositoryMutationLockOwner;
    context: RepositoryContext;
    currentHead: string;
  }) => boolean | Promise<boolean>;
}): Promise<RepositoryMutationLock> {
  const context = await resolveRepositoryContext(input.repositoryRoot, input.signal);
  const ownerRoot = resolve(context.commonDirectory, 'decision-os');
  const lockDirectory = resolve(ownerRoot, 'repository-mutation.lock');
  const ownerFile = resolve(lockDirectory, 'owner.json');
  mkdirSync(ownerRoot, { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      mkdirSync(lockDirectory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const existingOwner = readOwner(ownerFile);
      if (attempt === 0 && await reconcileStaleLock({
        context,
        lockDirectory,
        owner: existingOwner,
        signal: input.signal,
        authorizeChangedHeadRecovery: input.authorizeChangedHeadRecovery,
      })) continue;
      throw new RepositoryMutationLockError(existingOwner);
    }

    try {
      const owner: RepositoryMutationLockOwner = {
        version: 1,
        token: randomUUID(),
        pid: process.pid,
        processIdentity: repositoryMutationProcessIdentity(process.pid),
        purpose: input.purpose.slice(0, 240),
        head: await gitText({
          cwd: context.root,
          args: ['rev-parse', 'HEAD'],
          signal: input.signal,
          operation: 'acquire-head',
        }),
        acquiredAt: new Date().toISOString(),
      };
      writeFileSync(ownerFile, `${JSON.stringify(owner, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      let released = false;
      return {
        context,
        owner,
        lockDirectory,
        release(): void {
          if (released) return;
          const current = readOwner(ownerFile);
          if (!current || current.token !== owner.token) {
            throw new Error('The repository mutation lock owner changed before release.');
          }
          rmSync(lockDirectory, { recursive: true, force: true });
          released = true;
        },
      };
    } catch (error) {
      rmSync(lockDirectory, { recursive: true, force: true });
      throw error;
    }
  }
  throw new RepositoryMutationLockError(readOwner(ownerFile));
}
