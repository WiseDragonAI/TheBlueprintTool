/**
 * WHAT: Proves a completed feature merge retained dev's exact published and installed Decision OS child.
 * WHY: Feature Decision OS pointers are disposable and must never alter canonical dev child state.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type GitResult = { status: number; stdout: string; stderr: string };

export type DevIntegrationReceipt = {
  ok: true;
  childSource: string;
  decisionOsGitlink: string;
  devSha: string;
  devWorktree: string;
  featureSha: string;
  previousDecisionOsGitlink: string;
  verification: {
    childCheckoutInitialized: true;
    childCheckoutMatchesGitlink: true;
    childStatusClean: true;
    childHistoryContinuous: true;
    gitlinkPublished: true;
    parentStatusClean: true;
  };
};

export class DevIntegrationCheckError extends Error {
  constructor(readonly code: string, message: string, readonly exitCode: 2 | 3 = 2) {
    super(message);
    this.name = 'DevIntegrationCheckError';
  }
}

function git(root: string, args: readonly string[], acceptedStatuses: readonly number[] = [0]): GitResult {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30_000,
  });
  const status = result.status ?? 3;
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  // WHAT: Reject timeouts, spawn failures, and every unlisted Git exit status.
  // WHY: Integration cleanup cannot rely on partial repository evidence.
  if (result.error || !acceptedStatuses.includes(status)) {
    const detail = stderr.trim() || stdout.trim() || result.error?.message || `exit ${status}`;
    throw new DevIntegrationCheckError('dev_integration_git_failed', `git ${args[0] ?? ''} failed: ${detail}`, 3);
  }
  return { status, stdout, stderr };
}

function gitText(root: string, args: readonly string[]): string {
  return git(root, args).stdout.trim();
}

function resolvePersistentDevWorktree(repositoryRoot: string): string {
  const records = git(repositoryRoot, ['worktree', 'list', '--porcelain']).stdout.trim().split('\n\n');
  const devWorktrees = records.flatMap((record) => {
    const lines = record.split('\n');
    const worktree = lines.find((line) => line.startsWith('worktree '))?.slice('worktree '.length);
    const branch = lines.find((line) => line.startsWith('branch '))?.slice('branch '.length);
    // WHAT: Retain only the registered worktree that owns the exact dev branch ref.
    // WHY: Detached and feature worktrees cannot provide persistent runtime checkout evidence.
    return worktree && branch === 'refs/heads/dev' ? [resolve(worktree)] : [];
  });
  // WHAT: Require exactly one registered worktree to own the persistent dev branch.
  // WHY: Runtime checkout proof must not depend on the caller's current branch or an ambiguous path.
  if (devWorktrees.length !== 1) {
    throw new DevIntegrationCheckError('dev_integration_worktree_invalid', `Expected one refs/heads/dev worktree, found ${devWorktrees.length}.`);
  }
  return devWorktrees[0]!;
}

function assertParentClean(root: string): void {
  const parentStatus = gitText(root, ['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=all']);
  // WHAT: Reject parent changes outside the mutable child checkout.
  // WHY: Push and cleanup may proceed only after the merged parent tree is stable and reviewable.
  if (parentStatus) {
    throw new DevIntegrationCheckError('dev_integration_parent_dirty', `Parent dev worktree is not clean: ${parentStatus.split('\n').join(', ')}.`);
  }
}

function assertParentBoundary(root: string, expectedFeature: string): { devSha: string; featureSha: string; previousDevSha: string } {
  const branch = gitText(root, ['branch', '--show-current']);
  // WHAT: Admit only the persistent dev branch checkout.
  // WHY: The receipt is the cleanup gate for feature integration into dev, not a generic repository check.
  if (branch !== 'dev') {
    throw new DevIntegrationCheckError('dev_integration_branch_invalid', `Expected parent branch dev, found ${branch || 'detached HEAD'}.`);
  }
  const stage = gitText(root, ['ls-files', '--stage', '--', '.decision-os']);
  // WHAT: Require one stage-zero gitlink at the protected child path.
  // WHY: Individual Decision OS files cannot substitute for the contractual submodule boundary.
  if (!/^160000 [a-f0-9]{40,64} 0\t\.decision-os$/.test(stage)) {
    throw new DevIntegrationCheckError('dev_integration_submodule_boundary_invalid', '.decision-os is not one stage-zero Git submodule.');
  }
  const devSha = gitText(root, ['rev-parse', 'HEAD^{commit}']);
  // WHAT: Accept only an independently recorded full lowercase Git object ID.
  // WHY: Symbolic expressions such as HEAD^2 would make reviewed-feature binding tautological.
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(expectedFeature)) {
    throw new DevIntegrationCheckError('dev_integration_feature_invalid', `Expected one full lowercase feature commit ID, found ${expectedFeature}.`);
  }
  const featureSha = gitText(root, ['rev-parse', `${expectedFeature}^{commit}`]);
  const parents = gitText(root, ['show', '-s', '--format=%P', devSha]).split(' ').filter(Boolean);
  // WHAT: Require the completed integration commit to have exactly two parents.
  // WHY: The first parent is the authoritative pre-integration child-history boundary.
  if (parents.length !== 2) {
    throw new DevIntegrationCheckError('dev_integration_merge_required', `Expected one two-parent dev merge at ${devSha}, found ${parents.length} parent(s).`);
  }
  // WHAT: Bind the integration receipt to the reviewed feature commit supplied by the caller.
  // WHY: An unrelated two-parent merge cannot authorize deletion of the intended feature branch and worktree.
  if (parents[1] !== featureSha) {
    throw new DevIntegrationCheckError('dev_integration_feature_mismatch', `Expected second parent ${featureSha}, found ${parents[1] ?? 'none'}.`);
  }
  assertParentClean(root);
  return { devSha, featureSha, previousDevSha: parents[0]! };
}

function assertInstalledChild(root: string, decisionOsGitlink: string): { childRoot: string } {
  const childRoot = resolve(root, '.decision-os');
  // WHAT: Require submodule repository metadata inside the persistent dev checkout.
  // WHY: An empty submodule directory can otherwise make Git discover the parent repository and report a false match.
  if (!existsSync(join(childRoot, '.git'))) {
    throw new DevIntegrationCheckError('dev_integration_child_uninitialized', 'The persistent dev .decision-os checkout is not initialized.');
  }
  const childTopLevel = realpathSync(gitText(childRoot, ['rev-parse', '--show-toplevel']));
  // WHAT: Require Git commands from .decision-os to resolve to the child repository itself.
  // WHY: Parent-repository discovery is not proof that the submodule is installed.
  if (childTopLevel !== realpathSync(childRoot)) {
    throw new DevIntegrationCheckError('dev_integration_child_uninitialized', `Expected child repository root ${childRoot}, found ${childTopLevel}.`);
  }
  const childSha = gitText(childRoot, ['rev-parse', 'HEAD^{commit}']);
  // WHAT: Require the persistent child checkout to install the exact parent gitlink.
  // WHY: The running dev workspace reads child files from the checkout, not from the parent tree object.
  if (childSha !== decisionOsGitlink) {
    throw new DevIntegrationCheckError('dev_integration_child_mismatch', `Persistent child checkout ${childSha} does not match gitlink ${decisionOsGitlink}.`);
  }
  const submoduleStatus = gitText(root, ['submodule', 'status', '--', '.decision-os']);
  // WHAT: Reject Git's uninitialized and mismatched submodule status markers.
  // WHY: The runtime checkout must install the exact recorded child commit before cleanup.
  if (submoduleStatus.startsWith('-') || submoduleStatus.startsWith('+')) {
    throw new DevIntegrationCheckError('dev_integration_child_mismatch', `Persistent child status is not exact: ${submoduleStatus}.`);
  }
  const childStatus = gitText(childRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  // WHAT: Reject non-ignored authored changes in the persistent child checkout.
  // WHY: The runtime reads checkout bytes, so a clean HEAD alone cannot prove prompts and cards match the recorded gitlink.
  if (childStatus) {
    throw new DevIntegrationCheckError('dev_integration_child_dirty', `Persistent child checkout is not clean: ${childStatus.split('\n').join(', ')}.`);
  }
  return { childRoot };
}

function assertPublishedContinuousHistory(childSource: string, previousGitlink: string, decisionOsGitlink: string): void {
  const proofRoot = mkdtempSync(join(tmpdir(), 'decision-os-dev-integration-'));
  try {
    git(proofRoot, ['init', '--bare']);
    git(proofRoot, [
      '-c', 'protocol.file.allow=always',
      'fetch', '--quiet', '--force', '--tags', childSource,
      '+refs/heads/*:refs/remotes/source/*',
    ]);
    const published = git(proofRoot, ['cat-file', '-e', `${decisionOsGitlink}^{commit}`], [0, 128]);
    // WHAT: Reject a gitlink absent from all advertised source branches and tags.
    // WHY: Cleanup must not remove the only checkout capable of supplying the recorded child object.
    if (published.status !== 0) {
      throw new DevIntegrationCheckError('dev_integration_gitlink_unpublished', `Decision OS gitlink ${decisionOsGitlink} is not fetchable from ${childSource}.`);
    }
    const previousPublished = git(proofRoot, ['cat-file', '-e', `${previousGitlink}^{commit}`], [0, 128]);
    // WHAT: Reject an unavailable pre-integration child boundary.
    // WHY: Continuity cannot be proven when the prior durable state is absent from the configured source.
    if (previousPublished.status !== 0) {
      throw new DevIntegrationCheckError('dev_integration_previous_gitlink_unpublished', `Previous Decision OS gitlink ${previousGitlink} is not fetchable from ${childSource}.`);
    }
    const continuous = git(proofRoot, ['merge-base', '--is-ancestor', previousGitlink, decisionOsGitlink], [0, 1]);
    // WHAT: Reject a new gitlink outside the prior dev child ancestry.
    // WHY: Selecting a parallel child history can discard prompts and other authored state while remaining syntactically valid Git.
    if (continuous.status !== 0) {
      throw new DevIntegrationCheckError('dev_integration_child_history_diverged', `Decision OS gitlink ${decisionOsGitlink} does not descend from ${previousGitlink}.`);
    }
  } finally {
    rmSync(proofRoot, { recursive: true, force: true });
  }
}

export function checkDevIntegration(repositoryRoot: string, expectedFeature: string): DevIntegrationReceipt {
  const root = resolvePersistentDevWorktree(resolve(repositoryRoot));
  const { devSha, featureSha, previousDevSha } = assertParentBoundary(root, expectedFeature);
  const decisionOsGitlink = gitText(root, ['rev-parse', `${devSha}:.decision-os`]);
  const previousDecisionOsGitlink = gitText(root, ['rev-parse', `${previousDevSha}:.decision-os`]);
  // WHAT: Require the merge tree to retain the exact first-parent dev gitlink.
  // WHY: Feature Decision OS state is disposable and has no integration authority.
  if (decisionOsGitlink !== previousDecisionOsGitlink) {
    throw new DevIntegrationCheckError('dev_integration_child_replaced', `Merged gitlink ${decisionOsGitlink} differs from retained dev gitlink ${previousDecisionOsGitlink}.`);
  }
  assertInstalledChild(root, decisionOsGitlink);
  const childSource = git(root, ['config', '-f', '.gitmodules', '--get', 'submodule..decision-os.url'], [0, 1]).stdout.trim();
  // WHAT: Require the parent-authored child source used by fresh submodule initialization.
  // WHY: A checkout-local remote override is not durable delivery authority.
  if (!childSource) {
    throw new DevIntegrationCheckError('dev_integration_child_source_missing', '.gitmodules has no source URL for .decision-os.');
  }
  assertPublishedContinuousHistory(childSource, previousDecisionOsGitlink, decisionOsGitlink);
  assertInstalledChild(root, decisionOsGitlink);
  assertParentClean(root);
  const stableHead = gitText(root, ['rev-parse', 'HEAD^{commit}']);
  // WHAT: Reject a dev ref changed while remote and checkout evidence was collected.
  // WHY: The receipt must describe one immutable integration result.
  if (stableHead !== devSha) {
    throw new DevIntegrationCheckError('dev_integration_ref_changed', `dev changed from ${devSha} to ${stableHead} during verification.`, 3);
  }
  return {
    ok: true,
    childSource,
    decisionOsGitlink,
    devSha,
    devWorktree: root,
    featureSha,
    previousDecisionOsGitlink,
    verification: {
      childCheckoutInitialized: true,
      childCheckoutMatchesGitlink: true,
      childStatusClean: true,
      childHistoryContinuous: true,
      gitlinkPublished: true,
      parentStatusClean: true,
    },
  };
}

export function runDevIntegrationCheckCli(argv = process.argv.slice(2), cwd = process.cwd()): number {
  const json = argv.length === 3 && argv[0] === '--feature' && argv[2] === '--json';
  // WHAT: Accept only the fixed JSON receipt form.
  // WHY: Branch, source, gitlink, and dirty-state overrides would weaken the cleanup gate.
  if (!json) {
    process.stderr.write(`${JSON.stringify({ ok: false, code: 'dev_integration_usage', message: 'Usage: decision-os-dev-integration-check --feature <sha> --json' })}\n`);
    return 2;
  }
  try {
    process.stdout.write(`${JSON.stringify(checkDevIntegration(cwd, argv[1]!))}\n`);
    return 0;
  } catch (error) {
    const known = error instanceof DevIntegrationCheckError;
    process.stderr.write(`${JSON.stringify({
      ok: false,
      code: known ? error.code : 'dev_integration_check_failed',
      message: error instanceof Error ? error.message : String(error),
    })}\n`);
    return known ? error.exitCode : 3;
  }
}

// WHAT: Execute only when this module is the CLI entrypoint.
// WHY: Tests import the controller without running repository checks.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = runDevIntegrationCheckCli();
}
