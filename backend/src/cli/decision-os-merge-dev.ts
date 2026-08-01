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
type ReleaseBump = 'maj' | 'min' | 'fix';

export type MergeDevReceipt = {
  ok: true;
  devSha: string;
  decisionOsSha: string;
  decisionOsCommitCreated: boolean;
  gitlinkCommitCreated: boolean;
  logFile: string;
  mainSha: string;
  release: { tags: Array<{ name: string; repository: 'parent' | 'child'; target: string }>; version: string };
  verification: {
    childStatus: StatusRecord[];
    decisionOsGitlink: string;
    mergeParents: [string, string];
    parentStatus: StatusRecord[];
  };
};

export type MergeDevDoctorReport = {
  ok: true;
  result: 'READY' | 'NO-GO';
  blockers: Array<{ code: string; message: string }>;
  state: {
    parentBranch: string;
    mainSha: string;
    devSha: string;
    parentChanges: StatusRecord[];
    childBranch: string;
    childSha: string;
    childChanges: StatusRecord[];
    mainGitlink: string;
    devGitlink: string;
    logDirectoryIgnored: boolean;
    submoduleBoundaryValid: boolean;
  };
  expectedMerge: {
    release: { tags: string[]; version: string };
    commits: Array<{
      hash: string;
      message: string;
    }>;
    conflicts: string[];
    createDecisionOsCommit: boolean;
    createGitlinkCommit: boolean;
    createMergeCommit: boolean;
    preservedGitlink: string;
    sourceSha: string;
  };
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

function inferredRelease(root: string, bump: ReleaseBump): string {
  const releases = git(root, ['tag', '--list', 'rel-*']).stdout.split('\n').flatMap((tag) => {
    const match = /^rel-(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
    return match ? [[Number(match[1]), Number(match[2]), Number(match[3])] as const] : [];
  }).sort((left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2]);
  const latest = releases.at(-1);
  // WHAT: reject release inference without a canonical SemVer release baseline.
  // WHY: a bump token cannot safely invent a starting release version.
  if (!latest) throw new MergeDevError('merge_dev_release_baseline_missing', 'No canonical rel-X.Y.Z tag exists.');
  const [major, minor, fix] = latest;
  if (bump === 'maj') return `${major + 1}.0.0`;
  if (bump === 'min') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${fix + 1}`;
}

function sourceCommitPreview(root: string, mainSha: string, devSha: string): Array<{ hash: string; message: string }> {
  const fields = git(root, ['log', '--reverse', '--format=%H%x00%B%x00', `${mainSha}..${devSha}`]).stdout
    .split('\0');
  const commits: Array<{ hash: string; message: string }> = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    const hash = (fields[index] ?? '').trim();
    const message = fields[index + 1] ?? '';
    // WHAT: retain only complete Git log records with a commit identity.
    // WHY: doctor must not describe a truncated diagnostic record as a promotable commit.
    if (hash) commits.push({ hash, message });
  }
  return commits;
}

function releaseTagNames(version: string): string[] {
  return [`rel-${version}`, `devrel-${version}`];
}

function assertReleaseTagsAvailable(root: string, childRoot: string, version: string): void {
  for (const tag of releaseTagNames(version)) {
    // WHAT: reject an existing parent tag before promotion mutates either repository.
    // WHY: release tags are immutable rollback boundaries.
    if (git(root, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], [0, 1]).status === 0) throw new MergeDevError('merge_dev_release_tag_exists', `Parent release tag already exists: ${tag}`);
    // WHAT: reject an existing child tag before promotion mutates either repository.
    // WHY: parent and child release references must be created as one matching set.
    if (git(childRoot, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], [0, 1]).status === 0) throw new MergeDevError('merge_dev_release_tag_exists', `Decision OS release tag already exists: ${tag}`);
  }
}

function createReleaseTags(root: string, childRoot: string, version: string, mainSha: string, devSha: string, mainChildSha: string, devChildSha: string): Array<{ name: string; repository: 'parent' | 'child'; target: string }> {
  const tags = [
    { name: `rel-${version}`, repository: 'parent' as const, target: mainSha },
    { name: `devrel-${version}`, repository: 'parent' as const, target: devSha },
    { name: `rel-${version}`, repository: 'child' as const, target: mainChildSha },
    { name: `devrel-${version}`, repository: 'child' as const, target: devChildSha },
  ];
  for (const tag of tags) {
    const repository = tag.repository === 'parent' ? root : childRoot;
    git(repository, ['tag', '-a', tag.name, tag.target, '-m', `Mark ${tag.repository} release ${version}`, '-m', `WHAT: Mark the ${tag.repository} rollback boundary for release ${version}.\n\nWHY: Parent and Decision OS history must be recoverable as one release.`]);
  }
  return tags;
}

export type StatusRecord = { path: string; staged: boolean };

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
  const { conflicts, result } = inspectMergeSimulation(root, devSha);
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

function inspectMergeSimulation(root: string, devSha: string): { conflicts: string[]; result: GitResult } {
  const result = git(root, ['merge-tree', '--write-tree', 'HEAD', devSha], [0, 1]);
  return {
    conflicts: `${result.stdout}\n${result.stderr}`
      .split('\n')
      .filter((line) => line.startsWith('CONFLICT')),
    result,
  };
}

function doctorBlocker(blockers: MergeDevDoctorReport['blockers'], code: string, message: string): void {
  blockers.push({ code, message });
}

export function inspectMergeDev(repositoryRoot: string, bump: ReleaseBump = 'fix'): MergeDevDoctorReport {
  const root = resolve(repositoryRoot);
  const childRoot = resolve(root, '.decision-os');
  const parentBranch = gitText(root, ['branch', '--show-current']);
  const childBranch = gitText(childRoot, ['branch', '--show-current']);
  const mainSha = gitText(root, ['rev-parse', 'HEAD']);
  const devSha = gitText(root, ['rev-parse', '--verify', 'dev^{commit}']);
  const childSha = gitText(childRoot, ['rev-parse', 'HEAD']);
  const mainGitlink = gitText(root, ['rev-parse', 'HEAD:.decision-os']);
  const devGitlink = gitText(root, ['rev-parse', `${devSha}:.decision-os`]);
  const parentChanges = statusRecords(root, 'none');
  const childChanges = statusRecords(childRoot, 'all');
  const stagedParent = parentChanges.filter((record) => record.staged);
  const unrelatedParent = parentChanges.filter((record) => record.path !== '.decision-os');
  const parentUnmerged = gitText(root, ['diff', '--name-only', '--diff-filter=U']);
  const childUnmerged = gitText(childRoot, ['diff', '--name-only', '--diff-filter=U']);
  const submoduleBoundaryValid = /^160000 [a-f0-9]{40,64} 0\t\.decision-os$/.test(
    gitText(root, ['ls-files', '--stage', '--', '.decision-os']),
  );
  const logDirectoryIgnored = git(
    root,
    ['check-ignore', '--quiet', '--no-index', '.decision-os-merge-dev-logs/probe.jsonl'],
    [0, 1],
  ).status === 0;
  const simulation = inspectMergeSimulation(root, devSha);
  const unexpectedConflicts = simulation.conflicts.filter(
    (line) => line !== 'CONFLICT (submodule): Merge conflict in .decision-os',
  );
  const blockers: MergeDevDoctorReport['blockers'] = [];

  // WHAT: Report an invalid parent branch without changing checkout state.
  // WHY: Doctor must predict the same admission decision as the mutating command.
  if (parentBranch !== 'main') doctorBlocker(blockers, 'merge_dev_parent_branch_invalid', `Expected parent branch main, found ${parentBranch || 'detached HEAD'}.`);
  // WHAT: Report an invalid main child branch without checking out another branch.
  // WHY: Doctor is observational and cannot repair child ownership.
  if (childBranch !== 'main') doctorBlocker(blockers, 'merge_dev_child_branch_invalid', `Expected .decision-os branch main, found ${childBranch || 'detached HEAD'}.`);
  // WHAT: Report a missing or malformed gitlink boundary.
  // WHY: The merge command may preserve only an exact stage-zero submodule entry.
  if (!submoduleBoundaryValid) doctorBlocker(blockers, 'merge_dev_submodule_boundary_invalid', '.decision-os is not one initialized stage-zero Git submodule.');
  // WHAT: Report existing parent conflicts.
  // WHY: Doctor must distinguish pre-existing Git operations from predicted merge conflicts.
  if (parentUnmerged) doctorBlocker(blockers, 'merge_dev_parent_unmerged', `Parent repository contains unresolved paths: ${parentUnmerged.split('\n').join(', ')}.`);
  // WHAT: Report existing child conflicts.
  // WHY: Automatic child snapshots cannot commit an unresolved index.
  if (childUnmerged) doctorBlocker(blockers, 'merge_dev_child_unmerged', `Decision OS repository contains unresolved paths: ${childUnmerged.split('\n').join(', ')}.`);
  // WHAT: Report protected staged parent work.
  // WHY: The merge command never absorbs operator-approved index state.
  if (stagedParent.length > 0) doctorBlocker(blockers, 'merge_dev_parent_staged', `Parent index is not clean: ${stagedParent.map((record) => record.path).join(', ')}.`);
  // WHAT: Report parent dirt outside the exact submodule marker.
  // WHY: Only main Decision OS state may be snapshotted before promotion.
  if (unrelatedParent.length > 0) doctorBlocker(blockers, 'merge_dev_parent_dirty', `Parent worktree contains unrelated changes: ${unrelatedParent.map((record) => record.path).join(', ')}.`);
  // WHAT: Report missing ignore protection for durable doctor and merge logs.
  // WHY: Operational receipts must not make the parent dirty.
  if (!logDirectoryIgnored) doctorBlocker(blockers, 'merge_dev_log_directory_not_ignored', '.decision-os-merge-dev-logs/ is not ignored.');
  // WHAT: Report every predicted source conflict outside the protected gitlink.
  // WHY: The tool deliberately owns no source-code resolution policy.
  if (unexpectedConflicts.length > 0) doctorBlocker(blockers, 'merge_dev_source_conflict', unexpectedConflicts.join(' | '));
  // WHAT: Report an unclassified simulation failure.
  // WHY: Failed merge prediction without a conflict diagnosis cannot admit mutation.
  if (simulation.result.status !== 0 && simulation.conflicts.length === 0) doctorBlocker(blockers, 'merge_dev_simulation_failed', (simulation.result.stderr || simulation.result.stdout).trim());

  const createDecisionOsCommit = childChanges.length > 0;
  const version = inferredRelease(root, bump);
  const commits = sourceCommitPreview(root, mainSha, devSha);
  const result = blockers.length === 0 ? 'READY' : 'NO-GO';
  return {
    ok: true,
    result,
    blockers,
    state: {
      parentBranch,
      mainSha,
      devSha,
      parentChanges,
      childBranch,
      childSha,
      childChanges,
      mainGitlink,
      devGitlink,
      logDirectoryIgnored,
      submoduleBoundaryValid,
    },
    expectedMerge: {
      release: { version, tags: releaseTagNames(version) },
      commits,
      conflicts: simulation.conflicts,
      createDecisionOsCommit,
      createGitlinkCommit: createDecisionOsCommit || childSha !== mainGitlink,
      createMergeCommit: blockers.length === 0,
      preservedGitlink: createDecisionOsCommit ? 'new main Decision OS snapshot commit' : childSha,
      sourceSha: devSha,
    },
  };
}

export function formatDoctorReport(report: MergeDevDoctorReport): string {
  const changes = (records: StatusRecord[]): string => records.length === 0
    ? 'clean'
    : records.map((record) => `${record.staged ? 'staged' : 'unstaged'}:${record.path}`).join(', ');
  return [
    `RESULT ${report.result}`,
    `main ${report.state.mainSha} branch=${report.state.parentBranch} status=${changes(report.state.parentChanges)}`,
    `main-decision-os ${report.state.childSha} branch=${report.state.childBranch} status=${changes(report.state.childChanges)}`,
    `dev ${report.state.devSha}`,
    `gitlink-main ${report.state.mainGitlink}`,
    `gitlink-dev ${report.state.devGitlink}`,
    `expected-child-commit ${report.expectedMerge.createDecisionOsCommit ? 'yes' : 'no'}`,
    `expected-gitlink-commit ${report.expectedMerge.createGitlinkCommit ? 'yes' : 'no'}`,
    `expected-merge-commit ${report.expectedMerge.createMergeCommit ? 'yes' : 'no'}`,
    `expected-preserved-gitlink ${report.expectedMerge.preservedGitlink}`,
    `expected-release ${report.expectedMerge.release.version}`,
    `expected-tags ${report.expectedMerge.release.tags.join(' ')}`,
    `expected-source-commits ${report.expectedMerge.commits.length}`,
    ...report.expectedMerge.commits.flatMap((commit) => [
      '---',
      commit.hash,
      commit.message.trimEnd(),
    ]),
    `conflicts ${report.expectedMerge.conflicts.length === 0 ? 'none' : report.expectedMerge.conflicts.join(' | ')}`,
    `blockers ${report.blockers.length === 0 ? 'none' : report.blockers.map((blocker) => `${blocker.code}: ${blocker.message}`).join(' | ')}`,
  ].join('\n');
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

export async function mergeDevIntoMain(repositoryRoot: string, bump: ReleaseBump = 'fix'): Promise<MergeDevReceipt> {
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
    const devChildSha = gitText(root, ['rev-parse', `${devSha}:.decision-os`]);
    const version = inferredRelease(root, bump);
    assertReleaseTagsAvailable(root, childRoot, version);
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
    const decisionOsGitlink = gitText(root, ['rev-parse', 'HEAD:.decision-os']);
    // WHAT: Reject a final merge tree that does not retain the protected main gitlink.
    // WHY: The success receipt must prove the committed tree, not only the pre-commit index.
    if (decisionOsGitlink !== protectedGitlink) {
      throw new MergeDevError('merge_dev_final_gitlink_changed', `Final Decision OS gitlink changed from ${protectedGitlink} to ${decisionOsGitlink}.`, 3);
    }
    const parentStatus = statusRecords(root, 'none');
    const childStatus = statusRecords(childRoot, 'all');
    // WHAT: Reject a completed promotion that leaves parent or child repository changes behind.
    // WHY: A successful fixed merge must return both owning repositories to a clean observable state.
    if (parentStatus.length > 0 || childStatus.length > 0) {
      throw new MergeDevError(
        'merge_dev_final_status_dirty',
        `Promotion left repository changes: parent=${parentStatus.map((record) => record.path).join(', ') || 'clean'}; child=${childStatus.map((record) => record.path).join(', ') || 'clean'}.`,
        3,
      );
    }
    const releaseTags = createReleaseTags(root, childRoot, version, mainSha, devSha, decisionOsGitlink, devChildSha);
    const receipt: MergeDevReceipt = {
      ok: true,
      devSha,
      decisionOsSha: child.sha,
      decisionOsCommitCreated: child.created,
      gitlinkCommitCreated,
      logFile,
      mainSha,
      release: { tags: releaseTags, version },
      verification: {
        childStatus,
        decisionOsGitlink,
        mergeParents: [parents[0], parents[1]],
        parentStatus,
      },
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
  const doctor = argv[0] === 'doctor';
  const bump = (doctor ? argv[1] : argv[0]) as ReleaseBump;
  const json = argv.includes('--json');
  const bumpValid = bump === 'maj' || bump === 'min' || bump === 'fix';
  const doctorArgsValid = doctor && bumpValid && (argv.length === 2 || (argv.length === 3 && json));
  const mergeArgsValid = !doctor && bumpValid && (argv.length === 1 || (argv.length === 2 && json));
  // WHAT: Accept only the fixed merge and read-only doctor forms.
  // WHY: Strategy, branch, push, and dirty-state overrides would weaken the safety contract.
  if (!doctorArgsValid && !mergeArgsValid) {
    process.stderr.write(`${JSON.stringify({ ok: false, code: 'merge_dev_usage', message: 'Usage: decision-os-merge-dev <maj|min|fix> [--json] | decision-os-merge-dev doctor <maj|min|fix> [--json]' })}\n`);
    return 2;
  }
  try {
    // WHAT: Return the predicted merge without locks, logs, staging, commits, or ref updates.
    // WHY: Doctor is the explicit read-only admission preview requested by operators.
    if (doctor) {
      const report = inspectMergeDev(cwd, bump);
      process.stdout.write(`${json ? JSON.stringify(report) : formatDoctorReport(report)}\n`);
      return report.result === 'READY' ? 0 : 2;
    }
    const receipt = await mergeDevIntoMain(cwd, bump);
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
