/**
 * WHAT: Owns reviewed delivery Git preflight and isolated main promotion.
 * WHY: Production Git mutation must be exact-SHA, lease-bound, bounded, and leave operator checkouts untouched.
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import type { RepositoryMutationLock } from '../../content-authoring/helper/repository-mutation-lock.js';
import {
  runBoundedProcess,
  type BoundedProcessResult,
  type RunBoundedProcessInput,
} from '../../process/helper/run-bounded-process.js';
import { projectSyncGitSshCommand } from '../../project-sync/helper/project-sync-git-ssh-command.js';
import { redactDeliveryText } from './delivery-redactor.js';
import {
  mergeDevPreservingMainGitlink,
  ProtectedMergeError,
  type ProtectedMergeCommandResult,
  type ProtectedMergeExecutor,
} from './protected-dev-main-merge.js';

export type DeliveryGitRunner = (input: RunBoundedProcessInput) => Promise<BoundedProcessResult>;

export type DeliveryGitPreflight = {
  repositoryRoot: string;
  releaseSha: string;
  priorMainSha: string;
  originDevSha: string;
  releaseWorktrees: Array<{ path: string; branch: string; headSha: string }>;
};

export type DeliveryGitPromotion = DeliveryGitPreflight & {
  mainSha: string;
  mergeParents: [string, string];
  protectedGitlink: string;
};

export type DeliveryCandidateGitVerification = Omit<DeliveryGitPreflight, 'releaseWorktrees'> & {
  candidateWorktree: string;
};

export class DeliveryGitError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'DeliveryGitError';
  }
}

function sha(value: string, field: string): string {
  if (!/^[a-f0-9]{40}$/.test(value)) throw new DeliveryGitError(`delivery_${field}_invalid`, `${field} must be a lowercase 40-character Git SHA.`);
  return value;
}

function gitEnvironment(settings: unknown, environment: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const ssh = projectSyncGitSshCommand(settings);
  if (!ssh) throw new DeliveryGitError('delivery_git_ssh_identity_missing', 'The Wise SSH identity is not configured.');
  return { ...environment, GIT_SSH_COMMAND: ssh, GIT_TERMINAL_PROMPT: '0' };
}

async function git(input: {
  root: string;
  args: string[];
  runner: DeliveryGitRunner;
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  operation: string;
  allowFailure?: boolean;
}): Promise<string> {
  const result = await input.runner({
    command: 'git',
    args: ['-C', input.root, ...input.args],
    cwd: input.root,
    env: input.env,
    deadlineMs: 60_000,
    signal: input.signal,
    maximumOutputBytes: 1024 * 1024,
    context: { component: 'delivery-git', operation: input.operation },
  });
  if (!result.ok && !input.allowFailure) {
    const detail = redactDeliveryText(result.stderr.trim() || result.stdout.trim() || result.spawnError || result.termination || `exit ${result.exitCode}`);
    throw new DeliveryGitError(`delivery_git_${input.operation}_failed`, `Git ${input.operation} failed: ${detail}.`);
  }
  return result.ok ? result.stdout.trim() : '';
}

function deliveryProtectedMergeExecutor(input: {
  root: string;
  runner: DeliveryGitRunner;
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}): ProtectedMergeExecutor {
  return async (args, acceptedStatuses = [0], operation = 'protected_merge'): Promise<ProtectedMergeCommandResult> => {
    // WHAT: Install the fixed delivery commit identity only for the shared merge commit.
    // WHY: Immutable integration worktrees must not depend on an operator's global Git identity.
    const commandArgs = operation === 'commit_protected_merge'
      ? ['-c', 'user.name=Decision OS Delivery', '-c', 'user.email=decision-os-delivery@local', ...args]
      : [...args];
    const result = await input.runner({
      command: 'git',
      args: ['-C', input.root, ...commandArgs],
      cwd: input.root,
      env: input.env,
      deadlineMs: 60_000,
      signal: input.signal,
      maximumOutputBytes: 1024 * 1024,
      context: { component: 'delivery-git', operation },
    });
    const status = result.exitCode ?? 3;
    // WHAT: Reject process failures and every Git status outside the transaction's explicit boundary.
    // WHY: The protected merge may admit only its classified merge-conflict status.
    if (result.spawnError || result.termination || !acceptedStatuses.includes(status)) {
      const detail = redactDeliveryText(result.stderr.trim() || result.stdout.trim() || result.spawnError || result.termination || `exit ${status}`);
      throw new DeliveryGitError(`delivery_git_${operation}_failed`, `Git ${operation} failed: ${detail}.`);
    }
    return { status, stdout: result.stdout, stderr: result.stderr };
  };
}

export async function observeDeliveryGitAuthority(input: {
  repositoryRoot: string;
  admittedSha: string;
  priorMainSha: string;
  expectedMainSha: string | null;
  settings: unknown;
  runner?: DeliveryGitRunner;
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}): Promise<{
  observedAt: string;
  originDevSha: string;
  originMainSha: string;
  exactMerge: boolean;
  protectedGitlink: string;
}> {
  const repositoryRoot = resolve(input.repositoryRoot);
  const admittedSha = sha(input.admittedSha, 'admitted_sha');
  const priorMainSha = sha(input.priorMainSha, 'prior_main_sha');
  const runner = input.runner ?? runBoundedProcess;
  const env = gitEnvironment(input.settings, input.environment);
  await git({
    root: repositoryRoot,
    args: ['fetch', '--prune', 'origin', 'main', 'dev'],
    runner,
    env,
    signal: input.signal,
    operation: 'observe_fetch',
  });
  const originDevSha = sha(await git({
    root: repositoryRoot,
    args: ['rev-parse', 'refs/remotes/origin/dev'],
    runner,
    env,
    signal: input.signal,
    operation: 'observe_origin_dev',
  }), 'origin_dev_sha');
  const originMainSha = sha(await git({
    root: repositoryRoot,
    args: ['rev-parse', 'refs/remotes/origin/main'],
    runner,
    env,
    signal: input.signal,
    operation: 'observe_origin_main',
  }), 'origin_main_sha');
  let exactMerge = false;
  let protectedGitlink = '';
  // WHAT: Verify the exact merge parents and protected gitlink when a delivery result is expected.
  // WHY: Resume must not infer completion from ancestry alone after an interrupted promotion.
  if (input.expectedMainSha) {
    const expectedMainSha = sha(input.expectedMainSha, 'expected_main_sha');
    const parents = (await git({
      root: repositoryRoot,
      args: ['show', '-s', '--format=%P', expectedMainSha],
      runner,
      env,
      signal: input.signal,
      operation: 'observe_merge_parents',
    })).split(/\s+/).filter(Boolean);
    await git({
      root: repositoryRoot,
      args: ['merge-base', '--is-ancestor', admittedSha, expectedMainSha],
      runner,
      env,
      signal: input.signal,
      operation: 'observe_admitted_ancestry',
    });
    const priorGitlink = sha(await git({
      root: repositoryRoot,
      args: ['rev-parse', `${priorMainSha}:.decision-os`],
      runner,
      env,
      signal: input.signal,
      operation: 'observe_prior_gitlink',
    }), 'prior_gitlink');
    protectedGitlink = sha(await git({
      root: repositoryRoot,
      args: ['rev-parse', `${expectedMainSha}:.decision-os`],
      runner,
      env,
      signal: input.signal,
      operation: 'observe_final_gitlink',
    }), 'final_gitlink');
    exactMerge = originMainSha === expectedMainSha
      && parents.length === 2
      && parents[0] === priorMainSha
      && parents[1] === admittedSha
      && protectedGitlink === priorGitlink;
  }
  return { observedAt: new Date().toISOString(), originDevSha, originMainSha, exactMerge, protectedGitlink };
}

export async function assertDeliveryCredentialFileIgnored(input: {
  repositoryRoot: string;
  credentialFile: string | null;
  settings: unknown;
  runner?: DeliveryGitRunner;
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}): Promise<void> {
  if (!input.credentialFile) return;
  const repositoryRoot = resolve(input.repositoryRoot);
  const credentialFile = resolve(input.credentialFile);
  if (!credentialFile.startsWith(`${repositoryRoot}/`)) {
    throw new DeliveryGitError('delivery_credentials_file_outside_repository', 'The ignored credential file is outside the delivery repository.');
  }
  const runner = input.runner ?? runBoundedProcess;
  const env = gitEnvironment(input.settings, input.environment);
  await git({
    root: repositoryRoot,
    args: ['check-ignore', '--quiet', credentialFile],
    runner,
    env,
    signal: input.signal,
    operation: 'verify_credentials_ignored',
  });
}

function parseWorktrees(value: string): Array<{ path: string; branch: string; headSha: string }> {
  return value.split(/\n\n+/).flatMap((block) => {
    const lines = block.split('\n');
    const path = lines.find((line) => line.startsWith('worktree '))?.slice('worktree '.length) ?? '';
    if (!path) return [];
    return [{
      path: resolve(path),
      branch: (lines.find((line) => line.startsWith('branch refs/heads/'))?.slice('branch refs/heads/'.length) ?? ''),
      headSha: lines.find((line) => line.startsWith('HEAD '))?.slice('HEAD '.length) ?? '',
    }];
  });
}

function assertLease(repositoryRoot: string, lock: RepositoryMutationLock): void {
  if (resolve(lock.context.root) !== resolve(repositoryRoot) || !lock.owner.purpose.startsWith('decision-os-delivery:')) {
    throw new DeliveryGitError('delivery_git_lease_invalid', 'Delivery Git requires the matching repository mutation lease.');
  }
}

export async function verifyDeliveryCandidateGit(input: {
  repositoryRoot: string;
  releaseSha: string;
  settings: unknown;
  runner?: DeliveryGitRunner;
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  pathExists?: (path: string) => boolean;
}): Promise<DeliveryCandidateGitVerification> {
  const repositoryRoot = resolve(input.repositoryRoot);
  const releaseSha = sha(input.releaseSha, 'release_sha');
  const runner = input.runner ?? runBoundedProcess;
  const env = gitEnvironment(input.settings, input.environment);
  await git({ root: repositoryRoot, args: ['fetch', '--prune', 'origin', 'main', 'dev'], runner, env, signal: input.signal, operation: 'candidate_fetch' });
  const originDevSha = sha(await git({ root: repositoryRoot, args: ['rev-parse', 'refs/remotes/origin/dev'], runner, env, signal: input.signal, operation: 'candidate_read_origin_dev' }), 'origin_dev_sha');
  const priorMainSha = sha(await git({ root: repositoryRoot, args: ['rev-parse', 'refs/remotes/origin/main'], runner, env, signal: input.signal, operation: 'candidate_read_origin_main' }), 'origin_main_sha');
  if (originDevSha !== releaseSha) {
    throw new DeliveryGitError('delivery_release_ref_changed', 'The requested candidate is not the fetched origin/dev SHA.');
  }
  await git({
    root: repositoryRoot,
    args: ['merge-base', '--is-ancestor', priorMainSha, releaseSha],
    runner,
    env,
    signal: input.signal,
    operation: 'candidate_verify_main_ancestry',
  });
  const worktrees = parseWorktrees(await git({
    root: repositoryRoot,
    args: ['worktree', 'list', '--porcelain'],
    runner,
    env,
    signal: input.signal,
    operation: 'candidate_list_worktrees',
  }));
  const candidates = worktrees.filter((worktree) => worktree.branch === 'dev' || worktree.headSha === releaseSha);
  const candidate = candidates.find((worktree) => worktree.branch === 'dev' && worktree.headSha === releaseSha);
  if (!candidate) {
    throw new DeliveryGitError('delivery_candidate_worktree_missing', 'No dev worktree is checked out at the exact origin/dev candidate.');
  }
  for (const worktree of candidates) {
    const porcelain = await git({
      root: worktree.path,
      args: ['status', '--porcelain=v1', '--untracked-files=all'],
      runner,
      env,
      signal: input.signal,
      operation: 'candidate_read_worktree_status',
    });
    if (porcelain) throw new DeliveryGitError('delivery_release_worktree_dirty', `Candidate worktree ${basename(worktree.path)} is dirty.`);
  }
  const pathExists = input.pathExists ?? existsSync;
  for (const operationPath of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG', 'rebase-merge', 'rebase-apply']) {
    const path = await git({
      root: repositoryRoot,
      args: ['rev-parse', '--path-format=absolute', '--git-path', operationPath],
      runner,
      env,
      signal: input.signal,
      operation: 'candidate_resolve_operation_path',
    });
    if (path && pathExists(path)) throw new DeliveryGitError('delivery_git_operation_in_progress', `Git operation state ${operationPath} is active.`);
  }
  return { repositoryRoot, releaseSha, priorMainSha, originDevSha, candidateWorktree: candidate.path };
}

export async function preflightDeliveryGit(input: {
  repositoryRoot: string;
  releaseSha: string;
  repositoryLock: RepositoryMutationLock;
  settings: unknown;
  protectedOwnerPaths?: readonly string[];
  runner?: DeliveryGitRunner;
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  pathExists?: (path: string) => boolean;
}): Promise<DeliveryGitPreflight> {
  const repositoryRoot = resolve(input.repositoryRoot);
  const releaseSha = sha(input.releaseSha, 'release_sha');
  assertLease(repositoryRoot, input.repositoryLock);
  const runner = input.runner ?? runBoundedProcess;
  const env = gitEnvironment(input.settings, input.environment);

  await git({ root: repositoryRoot, args: ['fetch', '--prune', 'origin', 'main', 'dev'], runner, env, signal: input.signal, operation: 'fetch' });
  const originDevSha = sha(await git({ root: repositoryRoot, args: ['rev-parse', 'refs/remotes/origin/dev'], runner, env, signal: input.signal, operation: 'read_origin_dev' }), 'origin_dev_sha');
  const priorMainSha = sha(await git({ root: repositoryRoot, args: ['rev-parse', 'refs/remotes/origin/main'], runner, env, signal: input.signal, operation: 'read_origin_main' }), 'origin_main_sha');
  if (originDevSha !== releaseSha) {
    throw new DeliveryGitError('delivery_release_ref_changed', 'The requested release SHA is not the fetched origin/dev SHA.');
  }
  await git({
    root: repositoryRoot,
    args: ['merge-base', '--is-ancestor', priorMainSha, releaseSha],
    runner,
    env,
    signal: input.signal,
    operation: 'verify_main_ancestry',
  });
  const worktrees = parseWorktrees(await git({
    root: repositoryRoot,
    args: ['worktree', 'list', '--porcelain'],
    runner,
    env,
    signal: input.signal,
    operation: 'list_worktrees',
  }));
  const releaseWorktrees = worktrees.filter((worktree) => (
    worktree.branch === 'dev'
    || worktree.headSha === releaseSha
  ));
  for (const worktree of releaseWorktrees) {
    const porcelain = await git({
      root: worktree.path,
      args: ['status', '--porcelain=v1', '--untracked-files=all'],
      runner,
      env,
      signal: input.signal,
      operation: 'read_worktree_status',
    });
    if (porcelain) throw new DeliveryGitError('delivery_release_worktree_dirty', `Release worktree ${basename(worktree.path)} is dirty.`);
  }
  const staged = (await git({
    root: repositoryRoot,
    args: ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
    runner,
    env,
    signal: input.signal,
    operation: 'read_staged_paths',
  })).split('\n').filter(Boolean);
  const protectedPaths = new Set((input.protectedOwnerPaths ?? []).map((entry) => entry.replaceAll('\\', '/')));
  const stagedOwner = staged.find((entry) => protectedPaths.has(entry.replaceAll('\\', '/')));
  if (stagedOwner) throw new DeliveryGitError('delivery_protected_owner_staged', `Protected owner path ${stagedOwner} is staged.`);
  const pathExists = input.pathExists ?? existsSync;
  for (const operationPath of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG', 'rebase-merge', 'rebase-apply']) {
    const path = await git({
      root: repositoryRoot,
      args: ['rev-parse', '--path-format=absolute', '--git-path', operationPath],
      runner,
      env,
      signal: input.signal,
      operation: 'resolve_operation_path',
    });
    if (path && pathExists(path)) throw new DeliveryGitError('delivery_git_operation_in_progress', `Git operation state ${operationPath} is active.`);
  }
  return { repositoryRoot, releaseSha, priorMainSha, originDevSha, releaseWorktrees };
}

export async function promoteDeliveryMain(input: {
  preflight: DeliveryGitPreflight;
  repositoryLock: RepositoryMutationLock;
  settings: unknown;
  runner?: DeliveryGitRunner;
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  verifyCandidate: (input: { worktree: string; mainSha: string; signal?: AbortSignal }) => Promise<void>;
  integrationRoot?: string;
}): Promise<DeliveryGitPromotion> {
  assertLease(input.preflight.repositoryRoot, input.repositoryLock);
  const runner = input.runner ?? runBoundedProcess;
  const env = gitEnvironment(input.settings, input.environment);
  const parent = input.integrationRoot ? resolve(input.integrationRoot) : tmpdir();
  const worktree = mkdtempSync(resolve(parent, 'decision-os-delivery-main-'));
  let installed = false;
  try {
    await git({
      root: input.preflight.repositoryRoot,
      args: ['worktree', 'add', '--detach', worktree, input.preflight.priorMainSha],
      runner,
      env,
      signal: input.signal,
      operation: 'create_integration_worktree',
    });
    installed = true;
    const protectedGitlink = sha(await git({
      root: worktree,
      args: ['rev-parse', 'HEAD:.decision-os'],
      runner,
      env,
      signal: input.signal,
      operation: 'read_protected_gitlink',
    }), 'protected_gitlink');
    let merged;
    try {
      merged = await mergeDevPreservingMainGitlink({
        devSha: input.preflight.releaseSha,
        protectedGitlink,
        execute: deliveryProtectedMergeExecutor({ root: worktree, runner, env, signal: input.signal }),
      });
    } catch (error) {
      // WHAT: Translate shared merge decisions into the delivery Git error namespace.
      // WHY: Delivery journals and recovery classify failures by stable delivery-owned codes.
      if (error instanceof ProtectedMergeError) {
        throw new DeliveryGitError(`delivery_git_${error.code}`, error.message);
      }
      throw error;
    }
    const mainSha = sha(merged.mainSha, 'main_sha');
    await input.verifyCandidate({ worktree, mainSha, signal: input.signal });
    await git({ root: input.preflight.repositoryRoot, args: ['fetch', 'origin', 'main'], runner, env, signal: input.signal, operation: 'refetch_main' });
    const observedMain = sha(await git({
      root: input.preflight.repositoryRoot,
      args: ['rev-parse', 'refs/remotes/origin/main'],
      runner,
      env,
      signal: input.signal,
      operation: 'reread_origin_main',
    }), 'origin_main_sha');
    if (observedMain !== input.preflight.priorMainSha) {
      throw new DeliveryGitError('delivery_main_ref_changed', 'origin/main changed after candidate verification.');
    }
    await git({
      root: worktree,
      args: ['push', 'origin', `${mainSha}:refs/heads/main`],
      runner,
      env,
      signal: input.signal,
      operation: 'push_main',
    });
    return {
      ...input.preflight,
      mainSha,
      mergeParents: merged.mergeParents,
      protectedGitlink: merged.protectedGitlink,
    };
  } finally {
    if (installed) {
      await git({
        root: input.preflight.repositoryRoot,
        args: ['worktree', 'remove', '--force', worktree],
        runner,
        env,
        signal: input.signal,
        operation: 'remove_integration_worktree',
        allowFailure: true,
      });
    }
    if (existsSync(worktree)) rmSync(worktree, { recursive: true, force: true });
  }
}
