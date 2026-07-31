/**
 * WHAT: Commits main-owned Decision OS state and merges dev while preserving the main gitlink.
 * WHY: Dev intentionally hides mutable child state, so promotion needs one fail-closed repository boundary.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  acquireRepositoryMutationLock,
  type RepositoryMutationLock,
} from '../business/content-authoring/helper/repository-mutation-lock.js';

type GitResult = { status: number; stdout: string; stderr: string };

export type MergeDevReceipt = {
  ok: true;
  devSha: string;
  decisionOsSha: string;
  decisionOsCommitCreated: boolean;
  gitlinkCommitCreated: boolean;
  logFile: string;
  mainSha: string;
};

export class MergeDevError extends Error {
  logFile?: string;

  constructor(readonly code: string, message: string, readonly exitCode: 2 | 3 = 2) {
    super(message);
    this.name = 'MergeDevError';
  }
}

type PromotionLog = (event: string, detail?: Record<string, unknown>) => void;

function createPromotionLog(root: string): { log: PromotionLog; logFile: string } {
  const logDirectory = resolve(root, '.decision-os-merge-dev-logs');
  mkdirSync(logDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const logFile = join(logDirectory, `${timestamp}-${process.pid}.jsonl`);
  return {
    logFile,
    log(event, detail = {}): void {
      appendFileSync(logFile, `${JSON.stringify({ at: new Date().toISOString(), event, ...detail })}\n`, { encoding: 'utf8', mode: 0o600 });
    },
  };
}

function git(root: string, args: readonly string[], acceptedStatuses: readonly number[] = [0]): GitResult {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30_000,
  });
  const status = result.status ?? 3;
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  // WHAT: Reject timeouts, spawn failures, and every unlisted Git exit status.
  // WHY: Promotion must never interpret an incomplete Git operation as admissible state.
  if (result.error || !acceptedStatuses.includes(status)) {
    const detail = stderr.trim() || stdout.trim() || result.error?.message || `exit ${status}`;
    throw new MergeDevError('merge_dev_git_failed', `git ${args[0] ?? ''} failed: ${detail}`, 3);
  }
  return { status, stdout, stderr };
}

function gitText(root: string, args: readonly string[]): string {
  return git(root, args).stdout.trim();
}

type StatusRecord = { path: string; staged: boolean };

function statusRecords(root: string, ignoreSubmodules: 'all' | 'none'): StatusRecord[] {
  const output = git(root, [
    'status', '--porcelain=v1', '-z', '--untracked-files=all', `--ignore-submodules=${ignoreSubmodules}`,
  ]).stdout;
  const entries = output.split('\0').filter(Boolean);
  const records: StatusRecord[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] ?? '';
    const indexState = entry[0] ?? ' ';
    const path = entry.slice(3);
    records.push({ path, staged: indexState !== ' ' && indexState !== '?' });
    // WHAT: Consume the second path emitted for copy and rename records.
    // WHY: A renamed parent path must not evade the exact-path dirty-state gate.
    if (indexState === 'R' || indexState === 'C') {
      const sourcePath = entries[++index] ?? '';
      records.push({ path: sourcePath, staged: true });
    }
  }
  return records;
}

function assertExactMainBranches(root: string, childRoot: string): void {
  const parentBranch = gitText(root, ['branch', '--show-current']);
  // WHAT: Admit only the main parent branch.
  // WHY: The fixed command must not turn a feature worktree into a production promotion authority.
  if (parentBranch !== 'main') {
    throw new MergeDevError('merge_dev_parent_branch_invalid', `Expected parent branch main, found ${parentBranch || 'detached HEAD'}.`);
  }
  const childBranch = gitText(childRoot, ['branch', '--show-current']);
  // WHAT: Admit only the main child branch.
  // WHY: The automatic child commit must advance main-owned Decision OS history.
  if (childBranch !== 'main') {
    throw new MergeDevError('merge_dev_child_branch_invalid', `Expected .decision-os branch main, found ${childBranch || 'detached HEAD'}.`);
  }
}

function assertSubmoduleBoundary(root: string): void {
  const stage = gitText(root, ['ls-files', '--stage', '--', '.decision-os']);
  // WHAT: Require one stage-zero gitlink at the protected path.
  // WHY: Individual Decision OS files must never be committed into the parent repository.
  if (!/^160000 [a-f0-9]{40,64} 0\t\.decision-os$/.test(stage)) {
    throw new MergeDevError('merge_dev_submodule_boundary_invalid', '.decision-os is not one initialized stage-zero Git submodule.');
  }
}

function assertLogDirectoryIgnored(root: string): void {
  const result = git(root, ['check-ignore', '--quiet', '--no-index', '.decision-os-merge-dev-logs/probe.jsonl'], [0, 1]);
  // WHAT: Require the durable promotion log directory to be ignored before creating a receipt.
  // WHY: Operational merge logs must survive locally without becoming parent repository dirt.
  if (result.status !== 0) {
    throw new MergeDevError('merge_dev_log_directory_not_ignored', '.decision-os-merge-dev-logs/ must be ignored before promotion.');
  }
}

function assertParentDirtyBoundary(root: string): void {
  const records = statusRecords(root, 'none');
  const staged = records.filter((record) => record.staged);
  // WHAT: Reject every pre-existing staged parent path, including the gitlink.
  // WHY: Staged hunks are operator-approved and cannot be absorbed by an automatic commit.
  if (staged.length > 0) {
    throw new MergeDevError('merge_dev_parent_staged', `Parent index is not clean: ${staged.map((record) => record.path).join(', ')}.`);
  }
  const unrelated = records.filter((record) => record.path !== '.decision-os');
  // WHAT: Allow parent dirt only when it is the exact submodule marker.
  // WHY: Pre-merge commits may contain Decision OS state and nothing else.
  if (unrelated.length > 0) {
    throw new MergeDevError('merge_dev_parent_dirty', `Parent worktree contains unrelated changes: ${unrelated.map((record) => record.path).join(', ')}.`);
  }
}

function assertNoUnmergedPaths(root: string, scope: string): void {
  const paths = gitText(root, ['diff', '--name-only', '--diff-filter=U']);
  // WHAT: Reject unresolved entries before any new Git mutation.
  // WHY: The command owns no pre-existing conflict resolution decisions.
  if (paths) {
    throw new MergeDevError('merge_dev_unmerged_paths', `${scope} contains unresolved paths: ${paths.split('\n').join(', ')}.`);
  }
}

function assertMergeSimulation(root: string, devSha: string): void {
  const result = git(root, ['merge-tree', '--write-tree', 'HEAD', devSha], [0, 1]);
  // WHAT: Ignore only the expected protected gitlink conflict diagnostics.
  // WHY: Main deliberately retains its Decision OS pointer instead of merging dev child history.
  const conflicts = `${result.stdout}\n${result.stderr}`
    .split('\n')
    .filter((line) => line.startsWith('CONFLICT'));
  const unexpected = conflicts.filter((line) => line !== 'CONFLICT (submodule): Merge conflict in .decision-os');
  // WHAT: Reject every simulated conflict outside the exact gitlink.
  // WHY: An infrastructure command must not select source-code conflict outcomes.
  if (unexpected.length > 0) {
    throw new MergeDevError('merge_dev_source_conflict', `Dev cannot be promoted automatically: ${unexpected.join(' | ')}.`);
  }
  // WHAT: Reject unexplained merge-tree failure when no recognized gitlink conflict accounts for it.
  // WHY: A failed simulation without a classified conflict is not safe promotion evidence.
  if (result.status !== 0 && conflicts.length === 0) {
    throw new MergeDevError('merge_dev_simulation_failed', (result.stderr || result.stdout).trim(), 3);
  }
}

function commitChildState(childRoot: string): { created: boolean; sha: string } {
  git(childRoot, ['add', '-A']);
  const staged = git(childRoot, ['diff', '--cached', '--quiet'], [0, 1]).status === 1;
  // WHAT: Create a child commit only when non-ignored content changed.
  // WHY: Runtime files remain ignored and an empty Decision OS snapshot adds no provenance.
  if (staged) {
    git(childRoot, [
      'commit',
      '-m', 'Snapshot main Decision OS state',
      '-m', 'WHAT: Commit the current non-ignored Decision OS authored state.\nWHY: Preserve main-owned Decision OS content before dev promotion.',
    ]);
  }
  const remaining = statusRecords(childRoot, 'all');
  // WHAT: Require a clean non-ignored child immediately after its snapshot.
  // WHY: Concurrent authored writes must be rejected instead of omitted from the recorded pointer.
  if (remaining.length > 0) {
    throw new MergeDevError('merge_dev_child_changed_during_commit', `Decision OS remained dirty after commit: ${remaining.map((record) => record.path).join(', ')}.`, 3);
  }
  return { created: staged, sha: gitText(childRoot, ['rev-parse', 'HEAD']) };
}

function commitGitlink(root: string): boolean {
  git(root, ['add', '--', '.decision-os']);
  const stagedPaths = gitText(root, ['diff', '--cached', '--name-only']);
  // WHAT: Require the gitlink to be the sole possible parent commit path.
  // WHY: The snapshot commit must never absorb source or documentation files.
  if (stagedPaths && stagedPaths !== '.decision-os') {
    throw new MergeDevError('merge_dev_gitlink_scope_invalid', `Unexpected staged paths: ${stagedPaths.split('\n').join(', ')}.`, 3);
  }
  const changed = git(root, ['diff', '--cached', '--quiet'], [0, 1]).status === 1;
  // WHAT: Record a parent commit only when the child pointer advanced.
  // WHY: A clean child already represented by main needs no empty gitlink commit.
  if (changed) {
    git(root, [
      'commit',
      '-m', 'Advance main Decision OS snapshot',
      '-m', 'WHAT: Record the committed main Decision OS child revision.\nWHY: Keep main-owned Decision OS state stable across dev promotion.',
    ]);
  }
  return changed;
}

function mergeDev(root: string, devSha: string, protectedGitlink: string): string {
  let mergeStarted = false;
  try {
    mergeStarted = true;
    const result = git(root, ['merge', '--no-commit', '--no-ff', devSha], [0, 1]);
    git(root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', '.decision-os']);
    const conflicts = gitText(root, ['diff', '--name-only', '--diff-filter=U']);
    // WHAT: Abort when the real merge exposes any non-gitlink conflict missed by simulation.
    // WHY: Ref movement and Git behavior must fail closed rather than produce an inferred source resolution.
    if (result.status !== 0 && conflicts) {
      throw new MergeDevError('merge_dev_runtime_conflict', `Merge contains unresolved paths: ${conflicts.split('\n').join(', ')}.`);
    }
    const stagedGitlink = gitText(root, ['rev-parse', ':.decision-os']);
    // WHAT: Compare the staged merge gitlink to the post-snapshot main pointer.
    // WHY: Dev worktree visibility settings do not alter the committed gitlink merge input.
    if (stagedGitlink !== protectedGitlink) {
      throw new MergeDevError('merge_dev_gitlink_changed', 'The staged merge did not preserve the main Decision OS gitlink.', 3);
    }
    git(root, [
      'commit',
      '-m', 'Merge dev into main',
      '-m', 'WHAT: Merge the admitted dev parent-repository revision into main.\nWHY: Promote dev source while preserving main-owned Decision OS state.',
    ]);
    mergeStarted = false;
    return gitText(root, ['rev-parse', 'HEAD']);
  } catch (error) {
    // WHAT: Abort only a merge that this invocation started and did not commit.
    // WHY: A rejected promotion must not leave the parent index in a conflicted merge state.
    if (mergeStarted) git(root, ['merge', '--abort'], [0, 1, 128]);
    throw error;
  }
}

function releaseLock(lock: RepositoryMutationLock | undefined): void {
  // WHAT: Release only locks successfully acquired by this process.
  // WHY: Failed preflight must not disturb another mutation owner's lock.
  if (lock) lock.release();
}

export async function mergeDevIntoMain(repositoryRoot: string): Promise<MergeDevReceipt> {
  const root = resolve(repositoryRoot);
  const childRoot = resolve(root, '.decision-os');
  assertLogDirectoryIgnored(root);
  const { log, logFile } = createPromotionLog(root);
  let parentLock: RepositoryMutationLock | undefined;
  let childLock: RepositoryMutationLock | undefined;
  try {
    log('promotion-started', { root });
    parentLock = await acquireRepositoryMutationLock({ repositoryRoot: root, purpose: 'decision-os-merge-dev:parent' });
    childLock = await acquireRepositoryMutationLock({ repositoryRoot: childRoot, purpose: 'decision-os-merge-dev:child' });
    assertExactMainBranches(root, childRoot);
    assertSubmoduleBoundary(root);
    assertNoUnmergedPaths(root, 'Parent repository');
    assertNoUnmergedPaths(childRoot, 'Decision OS repository');
    assertParentDirtyBoundary(root);
    const devSha = gitText(root, ['rev-parse', '--verify', 'dev^{commit}']);
    assertMergeSimulation(root, devSha);
    log('promotion-admitted', { devSha, mainSha: gitText(root, ['rev-parse', 'HEAD']) });
    const child = commitChildState(childRoot);
    log('decision-os-snapshot-recorded', { commitCreated: child.created, decisionOsSha: child.sha });
    const gitlinkCommitCreated = commitGitlink(root);
    const protectedGitlink = gitText(root, ['rev-parse', 'HEAD:.decision-os']);
    log('main-gitlink-recorded', { commitCreated: gitlinkCommitCreated, protectedGitlink });
    const currentDevSha = gitText(root, ['rev-parse', '--verify', 'dev^{commit}']);
    // WHAT: Reject a dev ref changed after admission.
    // WHY: The merge must use the exact source commit assessed by the simulation.
    if (currentDevSha !== devSha) {
      throw new MergeDevError('merge_dev_ref_changed', `dev changed from ${devSha} to ${currentDevSha}.`, 3);
    }
    const priorMainSha = gitText(root, ['rev-parse', 'HEAD']);
    const mainSha = mergeDev(root, devSha, protectedGitlink);
    const parents = gitText(root, ['show', '-s', '--format=%P', mainSha]).split(' ');
    // WHAT: Require the fixed no-fast-forward merge parent order.
    // WHY: Completion must prove ancestry rather than trust the commit subject.
    if (parents.length !== 2 || parents[0] !== priorMainSha || parents[1] !== devSha) {
      throw new MergeDevError('merge_dev_parent_proof_failed', `Unexpected merge parents: ${parents.join(' ')}.`, 3);
    }
    const receipt: MergeDevReceipt = {
      ok: true,
      devSha,
      decisionOsSha: child.sha,
      decisionOsCommitCreated: child.created,
      gitlinkCommitCreated,
      logFile,
      mainSha,
    };
    log('promotion-completed', receipt);
    return receipt;
  } catch (error) {
    const code = error instanceof MergeDevError ? error.code : 'merge_dev_failed';
    const message = error instanceof Error ? error.message : String(error);
    log('promotion-failed', { code, message });
    // WHAT: Attach the durable receipt path to classified failures.
    // WHY: Agents must be able to locate rejection evidence without scanning temporary output.
    if (error instanceof MergeDevError) error.logFile = logFile;
    throw error;
  } finally {
    try {
      releaseLock(childLock);
    } finally {
      releaseLock(parentLock);
    }
  }
}

export async function runMergeDevCli(argv = process.argv.slice(2), cwd = process.cwd()): Promise<number> {
  // WHAT: Accept only the fixed command with optional machine-readable output declaration.
  // WHY: Strategy, branch, push, and dirty-state overrides would weaken the safety contract.
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== '--json')) {
    process.stderr.write(`${JSON.stringify({ ok: false, code: 'merge_dev_usage', message: 'Usage: decision-os-merge-dev [--json]' })}\n`);
    return 2;
  }
  try {
    const receipt = await mergeDevIntoMain(cwd);
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
    return 0;
  } catch (error) {
    const known = error instanceof MergeDevError;
    process.stderr.write(`${JSON.stringify({
      ok: false,
      code: known ? error.code : 'merge_dev_failed',
      logFile: known ? error.logFile : undefined,
      message: error instanceof Error ? error.message : String(error),
    })}\n`);
    return known ? error.exitCode : 3;
  }
}

// WHAT: Execute only when this module is the CLI entrypoint.
// WHY: Tests import the controller without triggering repository mutation.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await runMergeDevCli();
}
