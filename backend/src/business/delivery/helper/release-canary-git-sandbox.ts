/**
 * WHAT: Proves canonical dev-to-main promotion and paired-tag resolution in manifest-owned local Git repositories.
 * WHY: Release proof must preserve main child state and exercise production Git contracts without mutating or pushing source refs.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mergeDevIntoMain, type MergeDevReceipt } from '../../../cli/decision-os-merge-dev.js';
import { resolveDeliveryReleaseTag } from './delivery-git.js';
import {
  readReleaseCanaryManifest,
  recordReleaseCanaryGitProof,
  ReleaseCanaryHarnessError,
} from './release-canary-harness.js';

type ReleaseBump = 'maj' | 'min' | 'fix';

export type ReleaseCanaryGitReceipt = {
  mode: 'feature' | 'release-bound';
  receiptFile: string;
  receiptId: string;
  candidateSha: string;
  mainSha: string;
  releaseSha: string;
  priorMainSha: string;
  releaseTag: string;
  devReleaseTag: string;
  decisionOsSha: string;
  mainSentinelSha256: string | null;
  mainStateProof: 'synthetic-sentinel' | 'paired-child-tags';
  mainFirstParent: string;
  devSecondParent: string;
  parentTree: string;
  initializedChildHead: string;
  sandboxRoot: string;
  parentRemote: string;
  childRemote: string;
  merge: MergeDevReceipt | null;
};

function git(root: string, args: readonly string[]): string {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  // WHAT: Reject every failed or incomplete sandbox Git operation.
  // WHY: Release evidence cannot be inferred from partial repository mutation.
  if (result.error || result.status !== 0) {
    const detail = String(result.stderr ?? '').trim() || String(result.stdout ?? '').trim() || result.error?.message || `exit ${result.status}`;
    throw new ReleaseCanaryHarnessError('release_canary_git_failed', `Sandbox git ${args[0] ?? ''} failed: ${detail}.`);
  }
  return String(result.stdout ?? '').trim();
}

function configureIdentity(root: string): void {
  git(root, ['config', 'user.name', 'Decision OS Release Canary']);
  git(root, ['config', 'user.email', 'decision-os-release-canary@example.invalid']);
}

function exactSha(value: string, field: string): string {
  // WHAT: Accept only complete lowercase Git commit identities.
  // WHY: Every release relation is hash-bound and must not use symbolic ambiguity.
  if (!/^[a-f0-9]{40}$/.test(value)) throw new ReleaseCanaryHarnessError('release_canary_git_identity_invalid', `${field} is invalid.`);
  return value;
}

function sourceMainChildRepository(repositoryRoot: string, mainGitlink: string): string {
  const worktrees = git(repositoryRoot, ['worktree', 'list', '--porcelain']).split(/\n\n+/).map((block) => {
    const fields = new Map(block.split('\n').map((line) => [line.split(' ')[0], line.slice(line.indexOf(' ') + 1)]));
    return { path: fields.get('worktree') ?? '', branch: fields.get('branch') ?? '' };
  });
  const mainWorktree = worktrees.find((entry) => entry.branch === 'refs/heads/main');
  // WHAT: Require the source-owned local main worktree and initialized child.
  // WHY: The sandbox must never clone a configured child URL or contact an external remote.
  if (!mainWorktree?.path) throw new ReleaseCanaryHarnessError('release_canary_main_worktree_missing', 'Local main worktree is unavailable.');
  const childRoot = resolve(mainWorktree.path, '.decision-os');
  git(childRoot, ['cat-file', '-e', `${mainGitlink}^{commit}`]);
  return childRoot;
}

function canonicalReleaseTagsAtHead(repositoryRoot: string): string[] {
  return git(repositoryRoot, ['tag', '--points-at', 'HEAD', '--list', 'rel-*'])
    .split('\n')
    .filter((tag) => /^rel-(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag));
}

async function proveExistingRelease(input: {
  repositoryRoot: string;
  runId: string;
  candidateSha: string;
  releaseTag: string;
  sandboxRoot: string;
  parentRemote: string;
  childRemote: string;
}): Promise<ReleaseCanaryGitReceipt> {
  const tagsBefore = git(input.repositoryRoot, ['show-ref', '--tags']);
  const devReleaseTag = `devrel-${input.releaseTag.slice('rel-'.length)}`;
  const releaseSha = exactSha(git(input.repositoryRoot, ['rev-parse', `${devReleaseTag}^{commit}`]), 'releaseSha');
  const parents = git(input.repositoryRoot, ['show', '-s', '--format=%P', input.candidateSha]).split(/\s+/);
  // WHAT: Require the published tag to be one canonical two-parent promotion of its paired devrel tag.
  // WHY: Release-bound proof validates an existing release and must never reinterpret a noncanonical tag.
  if (parents.length !== 2 || parents[1] !== releaseSha) {
    throw new ReleaseCanaryHarnessError('release_canary_published_merge_invalid', 'Published release is not the canonical merge of its paired devrel tag.');
  }
  const priorMainSha = exactSha(parents[0] ?? '', 'priorMainSha');
  const mainGitlink = exactSha(git(input.repositoryRoot, ['rev-parse', `${input.candidateSha}:.decision-os`]), 'mainGitlink');
  const childSource = sourceMainChildRepository(input.repositoryRoot, mainGitlink);
  git(input.sandboxRoot, ['clone', '--mirror', '--no-hardlinks', input.repositoryRoot, input.parentRemote]);
  git(input.sandboxRoot, ['clone', '--mirror', '--no-hardlinks', childSource, input.childRemote]);
  git(input.sandboxRoot, ['--git-dir', input.parentRemote, 'update-ref', 'refs/heads/main', input.candidateSha]);
  git(input.sandboxRoot, ['--git-dir', input.parentRemote, 'update-ref', 'refs/heads/dev', releaseSha]);
  const mainRoot = resolve(input.sandboxRoot, 'main');
  git(input.sandboxRoot, ['clone', '--branch', 'main', input.parentRemote, mainRoot]);
  const identityFile = resolve(input.sandboxRoot, 'unused-local-git-identity');
  writeFileSync(identityFile, 'release-canary-local-only\n', { mode: 0o600 });
  chmodSync(identityFile, 0o600);
  const resolvedRelease = await resolveDeliveryReleaseTag({
    repositoryRoot: mainRoot,
    releaseTag: input.releaseTag,
    settings: { projectSyncGitSshIdentityFile: identityFile },
  });
  // WHAT: Bind the existing tag to checkout HEAD and its exact paired dev second parent.
  // WHY: A release-bound run must never mint or select another release identity.
  if (resolvedRelease.mainSha !== input.candidateSha || resolvedRelease.releaseSha !== releaseSha) {
    throw new ReleaseCanaryHarnessError('release_canary_published_identity_changed', 'Published release identity changed during local resolution.');
  }
  const childReleaseSha = exactSha(git(input.sandboxRoot, ['--git-dir', input.childRemote, 'rev-parse', `${input.releaseTag}^{commit}`]), 'childReleaseSha');
  const childDevReleaseSha = exactSha(git(input.sandboxRoot, ['--git-dir', input.childRemote, 'rev-parse', `${devReleaseTag}^{commit}`]), 'childDevReleaseSha');
  // WHAT: Require both existing child tags to identify the published parent gitlink.
  // WHY: Paired parent tags alone cannot prove which main-owned Decision OS state was released.
  if (childReleaseSha !== mainGitlink || childDevReleaseSha !== mainGitlink) {
    throw new ReleaseCanaryHarnessError('release_canary_published_child_tags_invalid', 'Published child tags do not match the release gitlink.');
  }
  const releaseCheckout = resolve(input.sandboxRoot, 'release-checkout');
  git(input.sandboxRoot, ['clone', '--branch', input.releaseTag, input.parentRemote, releaseCheckout]);
  git(releaseCheckout, ['config', 'protocol.file.allow', 'always']);
  git(releaseCheckout, ['config', 'submodule..decision-os.url', input.childRemote]);
  git(releaseCheckout, ['-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '.decision-os']);
  const parentTree = exactSha(git(input.repositoryRoot, ['rev-parse', `${input.releaseTag}^{tree}`]), 'parentTree');
  const checkoutTree = exactSha(git(releaseCheckout, ['rev-parse', 'HEAD^{tree}']), 'checkoutTree');
  const initializedChildHead = exactSha(git(resolve(releaseCheckout, '.decision-os'), ['rev-parse', 'HEAD']), 'initializedChildHead');
  // WHAT: Require exact parent tree and initialized child equality to existing release authority.
  // WHY: Release-bound proof must execute published bytes without creating a replacement merge.
  if (checkoutTree !== parentTree || initializedChildHead !== mainGitlink) {
    throw new ReleaseCanaryHarnessError('release_canary_published_checkout_invalid', 'Published release checkout does not match its tree and child gitlink.');
  }
  // WHAT: Require source tag refs to remain byte-identical after proof.
  // WHY: Release-bound mode is observational and must never mint, move, or delete a release tag.
  if (git(input.repositoryRoot, ['show-ref', '--tags']) !== tagsBefore) {
    throw new ReleaseCanaryHarnessError('release_canary_source_tags_changed', 'Source release tags changed during proof.');
  }
  const sentinelFile = resolve(releaseCheckout, '.decision-os', 'release-canary-main-sentinel');
  const receiptWithoutId = {
    mode: 'release-bound' as const,
    candidateSha: input.candidateSha,
    mainSha: resolvedRelease.mainSha,
    releaseSha: resolvedRelease.releaseSha,
    priorMainSha,
    releaseTag: input.releaseTag,
    devReleaseTag,
    decisionOsSha: mainGitlink,
    mainSentinelSha256: existsSync(sentinelFile) ? createHash('sha256').update(readFileSync(sentinelFile)).digest('hex') : null,
    mainStateProof: 'paired-child-tags' as const,
    mainFirstParent: priorMainSha,
    devSecondParent: releaseSha,
    parentTree,
    initializedChildHead,
    sandboxRoot: input.sandboxRoot,
    parentRemote: input.parentRemote,
    childRemote: input.childRemote,
    merge: null,
  };
  const recorded = recordReleaseCanaryGitProof({
    repositoryRoot: input.repositoryRoot,
    runId: input.runId,
    evidence: { phase: 'canonical-release', status: 'passed', evidence: receiptWithoutId },
    candidateSha: input.candidateSha,
    mainSha: resolvedRelease.mainSha,
    releaseSha: resolvedRelease.releaseSha,
    releaseTag: input.releaseTag,
  });
  return { receiptFile: recorded.receiptFile, receiptId: recorded.receiptId, ...receiptWithoutId };
}

export async function proveReleaseCanaryGitSandbox(input: {
  repositoryRoot: string;
  runId: string;
  bump: ReleaseBump;
}): Promise<ReleaseCanaryGitReceipt> {
  const repositoryRoot = realpathSync(resolve(input.repositoryRoot));
  const manifest = readReleaseCanaryManifest({ repositoryRoot, runId: input.runId });
  const sandboxRoot = resolve(manifest.runRoot, 'release-sandbox');
  const parentRemote = resolve(sandboxRoot, 'parent.git');
  const childRemote = resolve(sandboxRoot, 'child.git');
  const mainRoot = resolve(sandboxRoot, 'main');
  const devRoot = resolve(mainRoot, '.worktrees', 'dev');
  mkdirSync(sandboxRoot, { recursive: true });

  const sourceStatus = git(repositoryRoot, ['status', '--porcelain', '--untracked-files=no']);
  // WHAT: Reject tracked source dirt before binding candidate HEAD.
  // WHY: Uncommitted source bytes would not exist in the sandbox release tree.
  if (sourceStatus) throw new ReleaseCanaryHarnessError('release_canary_candidate_dirty', 'Candidate repository has uncommitted tracked changes.');
  const candidateSha = exactSha(git(repositoryRoot, ['rev-parse', 'HEAD']), 'candidateSha');
  const releaseTagsAtHead = canonicalReleaseTagsAtHead(repositoryRoot);
  // WHAT: Reject multiple canonical release identities on one commit.
  // WHY: Release-bound proof must select exactly one existing immutable release without operator input.
  if (releaseTagsAtHead.length > 1) {
    throw new ReleaseCanaryHarnessError('release_canary_published_tag_ambiguous', 'Published checkout has multiple canonical release tags.');
  }
  // WHAT: Validate an already-published release without invoking promotion.
  // WHY: HEAD at one canonical rel tag already owns its merge and paired identities.
  if (releaseTagsAtHead.length === 1) {
    return await proveExistingRelease({
      repositoryRoot,
      runId: input.runId,
      candidateSha,
      releaseTag: releaseTagsAtHead[0]!,
      sandboxRoot,
      parentRemote,
      childRemote,
    });
  }
  const sourceMainSha = exactSha(git(repositoryRoot, ['rev-parse', 'main^{commit}']), 'sourceMainSha');
  const sourceDevSha = exactSha(git(repositoryRoot, ['rev-parse', 'dev^{commit}']), 'sourceDevSha');
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', sourceDevSha, candidateSha], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  // WHAT: Require the candidate to descend from the exact local dev baseline.
  // WHY: Relabeling arbitrary HEAD as dev would bypass the accepted integration path.
  if (ancestor.status !== 0) throw new ReleaseCanaryHarnessError('release_canary_candidate_not_based_on_dev', 'Candidate HEAD does not descend from local dev.');
  const mainGitlink = exactSha(git(repositoryRoot, ['rev-parse', 'main:.decision-os']), 'mainGitlink');
  const childSource = sourceMainChildRepository(repositoryRoot, mainGitlink);
  git(sandboxRoot, ['clone', '--mirror', '--no-hardlinks', repositoryRoot, parentRemote]);
  git(sandboxRoot, ['clone', '--mirror', '--no-hardlinks', childSource, childRemote]);
  git(sandboxRoot, ['--git-dir', parentRemote, 'update-ref', 'refs/heads/main', sourceMainSha]);
  git(sandboxRoot, ['--git-dir', parentRemote, 'update-ref', 'refs/heads/dev', candidateSha]);
  git(sandboxRoot, ['clone', '--branch', 'main', parentRemote, mainRoot]);
  configureIdentity(mainRoot);
  git(mainRoot, ['config', 'protocol.file.allow', 'always']);
  git(mainRoot, ['config', 'submodule..decision-os.url', childRemote]);
  git(mainRoot, ['-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '.decision-os']);
  configureIdentity(resolve(mainRoot, '.decision-os'));
  git(resolve(mainRoot, '.decision-os'), ['switch', '-C', 'main']);
  writeFileSync(resolve(mainRoot, '.git', 'info', 'exclude'), '/.worktrees/\n', { flag: 'a' });
  git(mainRoot, ['branch', 'dev', candidateSha]);
  git(mainRoot, ['worktree', 'add', devRoot, 'dev']);

  const sentinelFile = resolve(mainRoot, '.decision-os', 'release-canary-main-sentinel');
  const sentinelBytes = `release-canary-main-state:${input.runId}\n`;
  writeFileSync(sentinelFile, sentinelBytes, { mode: 0o600 });
  const merge = await mergeDevIntoMain(mainRoot, input.bump);
  // WHAT: Require the sandbox merge to retain candidate HEAD as its admitted dev parent.
  // WHY: Synthetic Git setup must not replace the reviewed candidate release identity.
  if (merge.devSha !== candidateSha) {
    throw new ReleaseCanaryHarnessError('release_canary_candidate_identity_changed', 'Sandbox dev identity changed before promotion.');
  }
  const releaseTag = `rel-${merge.release.version}`;
  const devReleaseTag = `devrel-${merge.release.version}`;
  git(mainRoot, ['push', 'origin', 'main', 'dev', '--tags']);
  git(resolve(mainRoot, '.decision-os'), ['push', 'origin', '--tags']);

  const identityFile = resolve(sandboxRoot, 'unused-local-git-identity');
  writeFileSync(identityFile, 'release-canary-local-only\n', { mode: 0o600 });
  chmodSync(identityFile, 0o600);
  const resolvedRelease = await resolveDeliveryReleaseTag({
    repositoryRoot: mainRoot,
    releaseTag,
    settings: { projectSyncGitSshIdentityFile: identityFile },
  });
  const parents = git(mainRoot, ['show', '-s', '--format=%P', resolvedRelease.mainSha]).split(/\s+/);
  // WHAT: Require the canonical first-parent main and second-parent paired dev relation.
  // WHY: A tag pair is valid only when it identifies the exact protected merge graph.
  if (parents.length !== 2 || parents[0] !== resolvedRelease.priorMainSha || parents[1] !== resolvedRelease.releaseSha) {
    throw new ReleaseCanaryHarnessError('release_canary_merge_graph_invalid', 'Sandbox release merge graph is invalid.');
  }
  const parentTree = exactSha(git(mainRoot, ['rev-parse', `${releaseTag}^{tree}`]), 'parentTree');
  const releaseCheckout = resolve(sandboxRoot, 'release-checkout');
  git(sandboxRoot, ['clone', '--branch', releaseTag, parentRemote, releaseCheckout]);
  git(releaseCheckout, ['config', 'protocol.file.allow', 'always']);
  git(releaseCheckout, ['config', 'submodule..decision-os.url', childRemote]);
  git(releaseCheckout, ['-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '.decision-os']);
  const checkoutTree = exactSha(git(releaseCheckout, ['rev-parse', 'HEAD^{tree}']), 'checkoutTree');
  const initializedChildHead = exactSha(git(resolve(releaseCheckout, '.decision-os'), ['rev-parse', 'HEAD']), 'initializedChildHead');
  const recordedGitlink = exactSha(git(releaseCheckout, ['rev-parse', 'HEAD:.decision-os']), 'recordedGitlink');
  // WHAT: Require exact tagged tree and initialized child-gitlink equality.
  // WHY: Deployment must execute the published parent and child bytes selected by the release tags.
  if (checkoutTree !== parentTree || initializedChildHead !== recordedGitlink || recordedGitlink !== merge.decisionOsSha) {
    throw new ReleaseCanaryHarnessError('release_canary_release_checkout_invalid', 'Sandbox release checkout does not match the published release tree and gitlink.');
  }
  // WHAT: Require the main-only child sentinel to survive promotion and release checkout.
  // WHY: The canonical merge must preserve main Decision OS state instead of importing the dev gitlink.
  if (readFileSync(resolve(releaseCheckout, '.decision-os', 'release-canary-main-sentinel'), 'utf8') !== sentinelBytes) {
    throw new ReleaseCanaryHarnessError('release_canary_main_state_not_preserved', 'Main Decision OS sentinel was not preserved.');
  }
  const receiptWithoutId = {
    mode: 'feature' as const,
    candidateSha,
    mainSha: resolvedRelease.mainSha,
    releaseSha: resolvedRelease.releaseSha,
    priorMainSha: resolvedRelease.priorMainSha,
    releaseTag,
    devReleaseTag,
    decisionOsSha: merge.decisionOsSha,
    mainSentinelSha256: createHash('sha256').update(sentinelBytes).digest('hex'),
    mainStateProof: 'synthetic-sentinel' as const,
    mainFirstParent: parents[0],
    devSecondParent: parents[1],
    parentTree,
    initializedChildHead,
    sandboxRoot,
    parentRemote,
    childRemote,
    merge,
  };
  const recorded = recordReleaseCanaryGitProof({
    repositoryRoot,
    runId: input.runId,
    evidence: { phase: 'canonical-release', status: 'passed', evidence: receiptWithoutId },
    candidateSha,
    mainSha: resolvedRelease.mainSha,
    releaseSha: resolvedRelease.releaseSha,
    releaseTag,
  });
  return { receiptFile: recorded.receiptFile, receiptId: recorded.receiptId, ...receiptWithoutId };
}
