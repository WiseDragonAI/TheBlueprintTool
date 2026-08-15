#!/usr/bin/env node
/**
 * WHAT: Owns canonical Decision OS dev and feature worktree setup and integration.
 * WHY: Manual Git, submodule, dependency, admission, push, and cleanup steps created divergent worktree state.
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  closeSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const primaryRoot = basename(dirname(scriptRoot)) === '.worktrees' ? dirname(dirname(scriptRoot)) : scriptRoot;
const devRoot = resolve(primaryRoot, '.worktrees', 'dev');
const dependencyContracts = [
  { name: 'backend', proof: 'tsx/dist/loader.mjs' },
  { name: 'frontend', proof: 'tsx/dist/esm/index.mjs' },
  { name: 'federation-relay', proof: 'typescript/bin/tsc' },
];
const generatedSearchIgnoreBefore = '/executor-analysis/';
const generatedSearchIgnoreAfter = '/frontend-telemetry.jsonl*';

export class WorktreeCliError extends Error {
  constructor(code, message, exitCode = 2, instruction = '') {
    super(message);
    this.name = 'WorktreeCliError';
    this.code = code;
    this.exitCode = exitCode;
    this.instruction = instruction;
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? primaryRoot,
    encoding: 'utf8',
    env: options.env ?? process.env,
    maxBuffer: 16 * 1024 * 1024,
    stdio: options.inherit ? 'inherit' : 'pipe',
    timeout: options.timeout ?? 120_000,
  });
  const accepted = options.accepted ?? [0];
  // WHAT: Reject every unadmitted command settlement.
  // WHY: Worktree lifecycle mutation cannot continue from partial Git, npm, verification, or push state.
  if (result.error || !accepted.includes(result.status ?? 3)) {
    const detail = String(result.stderr || result.stdout || result.error?.message || `exit ${result.status}`).trim();
    throw new WorktreeCliError(options.code ?? 'worktree_command_failed', `${command} ${args[0] ?? ''} failed: ${detail}`, 3);
  }
  return {
    status: result.status ?? 0,
    stdout: options.raw ? String(result.stdout ?? '') : String(result.stdout ?? '').trim(),
    stderr: options.raw ? String(result.stderr ?? '') : String(result.stderr ?? '').trim(),
  };
}

function git(root, args, options = {}) {
  return run('git', args, { ...options, cwd: root, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', ...(options.env ?? {}) } });
}

function gitText(root, args) {
  return git(root, args).stdout;
}

function pathExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

export function assertFeatureName(name) {
  // WHAT: Admit one portable feature slug without path or ref syntax.
  // WHY: One slug must safely own the branch, worktree directory, child branch, and JSON receipt.
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(name)) {
    throw new WorktreeCliError('worktree_name_invalid', `Invalid feature name: ${name || '(empty)'}.`);
  }
  return name;
}

function registeredWorktrees() {
  const records = git(primaryRoot, ['worktree', 'list', '--porcelain']).stdout.split('\n\n').filter(Boolean);
  return records.map((record) => {
    const lines = record.split('\n');
    return {
      path: resolve(lines.find((line) => line.startsWith('worktree '))?.slice(9) ?? ''),
      branch: lines.find((line) => line.startsWith('branch '))?.slice(7) ?? '',
    };
  });
}

function assertCanonicalDevRegistration() {
  const owners = registeredWorktrees().filter((record) => record.branch === 'refs/heads/dev');
  // WHAT: Require one exact persistent dev branch owner at the canonical path.
  // WHY: Feature baselines and integration cannot depend on an ambiguous or transient dev checkout.
  if (owners.length !== 1 || realpathSync(owners[0].path) !== realpathSync(devRoot)) {
    throw new WorktreeCliError('worktree_dev_registration_invalid', `Expected refs/heads/dev only at ${devRoot}.`);
  }
}

function exactStatus(root, ignoredSubmodules = false) {
  const args = ['status', '--porcelain=v1', '--untracked-files=all'];
  // WHAT: Ignore mutable child checkout bytes only for the parent cleanliness boundary that owns a gitlink.
  // WHY: Parent integration cleanliness and child authored cleanliness are verified independently.
  if (ignoredSubmodules) args.push('--ignore-submodules=all');
  return gitText(root, args);
}

export function repairKnownGeneratedSearchIgnore(root) {
  const path = resolve(root, 'Search', '.decision-os', '.gitignore');
  // WHAT: Leave dev unchanged when the known generated fixture path is absent.
  // WHY: Repositories without the historical Search fixture need no migration.
  if (!existsSync(path)) return [];
  const status = gitText(root, ['status', '--porcelain=v1', '--', 'Search/.decision-os/.gitignore']);
  // WHAT: Leave the tracked fixture unchanged when Git reports no mutation.
  // WHY: Canonical setup is idempotent after the one-time generated-state repair.
  if (!status) return [];
  const head = git(root, ['show', 'HEAD:Search/.decision-os/.gitignore'], { raw: true }).stdout;
  const current = readFileSync(path, 'utf8');
  const expected = head.replace(generatedSearchIgnoreBefore, generatedSearchIgnoreAfter);
  // WHAT: Refuse every tracked change except the exact server-generated replacement reproduced by the isolated canary.
  // WHY: Dev setup must never erase operator-authored or unexplained tracked bytes.
  if (current !== expected || head === expected) {
    throw new WorktreeCliError('worktree_dev_tracked_dirty', 'Search/.decision-os/.gitignore contains noncanonical tracked changes.');
  }
  writeFileSync(path, head);
  return ['Search/.decision-os/.gitignore'];
}

export function installRealDependencies(packageRoot, proofRelative) {
  const dependencyPath = resolve(packageRoot, 'node_modules');
  // WHAT: Reuse one complete package-owned dependency directory.
  // WHY: Canonical dev setup must remain idempotent and avoid unnecessary package installation.
  if (pathExists(dependencyPath) && !lstatSync(dependencyPath).isSymbolicLink() && existsSync(resolve(dependencyPath, proofRelative))) {
    return { package: basename(packageRoot), action: 'retained', path: dependencyPath };
  }
  const stagingRoot = mkdtempSync(resolve(packageRoot, '.decision-os-dependencies-'));
  try {
    copyFileSync(resolve(packageRoot, 'package.json'), resolve(stagingRoot, 'package.json'));
    copyFileSync(resolve(packageRoot, 'package-lock.json'), resolve(stagingRoot, 'package-lock.json'));
    run('npm', ['ci', '--ignore-scripts', '--prefix', stagingRoot], {
      cwd: primaryRoot,
      timeout: 1_200_000,
      code: 'worktree_dependency_install_failed',
    });
    const stagedDependencies = resolve(stagingRoot, 'node_modules');
    // WHAT: Reject a package installation that lacks its package-specific runtime proof.
    // WHY: A partial install would fail after the canonical setup receipt was issued.
    if (!existsSync(resolve(stagedDependencies, proofRelative))) {
      throw new WorktreeCliError('worktree_dependency_install_incomplete', `Dependency proof is missing for ${basename(packageRoot)}.`);
    }
    // WHAT: Remove only an existing dependency symlink before installing the real package-owned directory.
    // WHY: Following the symlink could mutate dependencies owned by the primary checkout.
    if (pathExists(dependencyPath) && lstatSync(dependencyPath).isSymbolicLink()) unlinkSync(dependencyPath);
    // WHAT: Reject an incomplete real directory instead of deleting unexplained dependency bytes.
    // WHY: Setup repairs only the known symlink topology and preserves unknown local installations.
    if (pathExists(dependencyPath)) {
      throw new WorktreeCliError('worktree_dependency_directory_invalid', `${dependencyPath} is an incomplete real directory.`);
    }
    renameSync(stagedDependencies, dependencyPath);
    return { package: basename(packageRoot), action: 'installed', path: dependencyPath };
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

function installDevChild() {
  git(devRoot, ['-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '--', '.decision-os'], { timeout: 180_000 });
  git(devRoot, ['config', '--worktree', 'submodule..decision-os.ignore', 'all']);
  const gitlink = gitText(devRoot, ['rev-parse', 'HEAD:.decision-os']);
  const checkout = gitText(resolve(devRoot, '.decision-os'), ['rev-parse', 'HEAD^{commit}']);
  // WHAT: Require the persistent child checkout to install the exact parent gitlink.
  // WHY: The dev server reads checkout bytes rather than the parent tree object.
  if (gitlink !== checkout) throw new WorktreeCliError('worktree_dev_child_mismatch', `Dev child ${checkout} does not match ${gitlink}.`);
  return gitlink;
}

function writeDevManifest(receipt) {
  const gitDirectory = gitText(devRoot, ['rev-parse', '--absolute-git-dir']);
  const manifest = resolve(gitDirectory, 'decision-os-worktree.json');
  writeFileSync(manifest, `${JSON.stringify({ version: 1, ...receipt }, null, 2)}\n`);
  return manifest;
}

export function initDev(options = {}) {
  assertCanonicalDevRegistration();
  const repairedGeneratedPaths = repairKnownGeneratedSearchIgnore(devRoot);
  const ignoreRules = readFileSync(resolve(devRoot, '.gitignore'), 'utf8').split('\n');
  const relayDependenciesIgnored = ignoreRules.includes('federation-relay/node_modules') || ignoreRules.includes('federation-relay/node_modules/');
  const dependencies = dependencyContracts.map((contract) => {
    const dependencyPath = resolve(devRoot, contract.name, 'node_modules');
    // WHAT: Defer only the legacy relay dependency symlink until the integrating feature installs its repository ignore rule.
    // WHY: The bootstrap integration must become naturally clean without a temporary Git exclusion.
    if (options.deferLegacyRelay === true && contract.name === 'federation-relay' && !relayDependenciesIgnored) {
      // WHAT: Remove only the known relay dependency symlink whose target remains owned by the primary checkout.
      // WHY: A symlink is not matched by the historical trailing-slash ignore rule and blocks the pre-merge cleanliness gate.
      if (pathExists(dependencyPath) && lstatSync(dependencyPath).isSymbolicLink()) unlinkSync(dependencyPath);
      // WHAT: Reject unexplained real relay dependencies before the repository owns their ignore boundary.
      // WHY: Bootstrap must not hide or delete an existing real installation.
      if (pathExists(dependencyPath)) throw new WorktreeCliError('worktree_dependency_directory_invalid', `${dependencyPath} exists before its ignore rule.`);
      return { package: contract.name, action: 'deferred', path: dependencyPath };
    }
    return installRealDependencies(resolve(devRoot, contract.name), contract.proof);
  });
  const decisionOsGitlink = installDevChild();
  const status = exactStatus(devRoot, true);
  // WHAT: Reject every remaining parent mutation after canonical provisioning.
  // WHY: Dev is the immutable feature baseline and integration target, not a general working directory.
  if (status) throw new WorktreeCliError('worktree_dev_dirty', `Canonical dev is dirty: ${status.split('\n').join(', ')}.`);
  const receipt = {
    ok: true,
    command: 'init-dev',
    devRoot,
    devSha: gitText(devRoot, ['rev-parse', 'HEAD^{commit}']),
    decisionOsGitlink,
    dependencies,
    repairedGeneratedPaths,
  };
  return { ...receipt, manifest: writeDevManifest(receipt) };
}

function linkFeatureDependencies(featureRoot) {
  return dependencyContracts.map((contract) => {
    const target = resolve(devRoot, contract.name, 'node_modules');
    const link = resolve(featureRoot, contract.name, 'node_modules');
    // WHAT: Reject an unavailable canonical dependency owner.
    // WHY: Feature worktrees must never link to the primary checkout or another temporary feature.
    if (!existsSync(resolve(target, contract.proof))) throw new WorktreeCliError('worktree_dev_dependencies_missing', `Canonical dependencies are missing for ${contract.name}.`);
    // WHAT: Preserve an exact canonical feature dependency link.
    // WHY: Repeated setup must not replace a valid worktree dependency boundary.
    if (pathExists(link) && lstatSync(link).isSymbolicLink() && realpathSync(link) === realpathSync(target)) {
      return { package: contract.name, path: link, target, action: 'retained' };
    }
    // WHAT: Reject every existing noncanonical dependency entry.
    // WHY: Creation must not destroy feature-owned installations or links from another checkout.
    if (pathExists(link)) throw new WorktreeCliError('worktree_feature_dependencies_invalid', `${link} already exists and is not canonical.`);
    symlinkSync(target, link, 'dir');
    return { package: contract.name, path: link, target, action: 'linked' };
  });
}

export function createFeature(name) {
  const slug = assertFeatureName(name);
  git(devRoot, ['fetch', 'origin', 'dev'], { timeout: 180_000 });
  const dev = initDev();
  const publishedDevSha = gitText(devRoot, ['rev-parse', 'origin/dev^{commit}']);
  // WHAT: Create a new iteration only from the exact published canonical dev baseline.
  // WHY: An unpublished local merge cannot silently become another feature's ancestry.
  if (dev.devSha !== publishedDevSha) throw new WorktreeCliError('worktree_dev_unpublished', `Local dev ${dev.devSha} differs from origin/dev ${publishedDevSha}.`);
  const featureRoot = resolve(primaryRoot, '.worktrees', slug);
  const branch = `feature/${slug}`;
  // WHAT: Reject a colliding parent branch or worktree path.
  // WHY: Creation is one-shot and never adopts unexplained prior state.
  if (pathExists(featureRoot) || git(primaryRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { accepted: [0, 1] }).status === 0) {
    throw new WorktreeCliError('worktree_feature_exists', `${branch} or ${featureRoot} already exists.`);
  }
  git(primaryRoot, ['worktree', 'add', '-b', branch, featureRoot, dev.devSha], { timeout: 180_000 });
  try {
    git(featureRoot, ['-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '--', '.decision-os'], { timeout: 180_000 });
    const child = resolve(featureRoot, '.decision-os');
    git(child, ['switch', '-c', branch]);
    const dependencies = linkFeatureDependencies(featureRoot);
    const status = exactStatus(featureRoot, false);
    // WHAT: Require a newly created parent and child checkout with no authored mutations.
    // WHY: The creation receipt is the immutable iteration baseline.
    if (status || exactStatus(child, false)) throw new WorktreeCliError('worktree_feature_dirty', `New feature worktree is not clean: ${status}.`);
    return {
      ok: true,
      command: 'create',
      name: slug,
      branch,
      featureRoot,
      featureSha: gitText(featureRoot, ['rev-parse', 'HEAD^{commit}']),
      decisionOsGitlink: gitText(featureRoot, ['rev-parse', 'HEAD:.decision-os']),
      dependencies,
    };
  } catch (error) {
    git(primaryRoot, ['worktree', 'remove', '--force', featureRoot], { accepted: [0, 128] });
    git(primaryRoot, ['branch', '-D', branch], { accepted: [0, 1, 128] });
    throw error;
  }
}

export function assertFeatureReady(name) {
  const slug = assertFeatureName(name);
  const featureRoot = resolve(primaryRoot, '.worktrees', slug);
  const branch = `feature/${slug}`;
  const owners = registeredWorktrees().filter((record) => record.path === featureRoot && record.branch === `refs/heads/${branch}`);
  // WHAT: Require the exact registered feature worktree and branch pair.
  // WHY: Integration must not accept a similarly named detached checkout.
  if (owners.length !== 1) throw new WorktreeCliError('worktree_feature_registration_invalid', `Expected ${branch} at ${featureRoot}.`);
  const parentStatus = exactStatus(featureRoot, true);
  const childStatus = exactStatus(resolve(featureRoot, '.decision-os'), false);
  // WHAT: Require committed parent and child feature state before integration.
  // WHY: The reviewed feature SHA and gitlink must fully own the delivered bytes.
  if (parentStatus || childStatus) throw new WorktreeCliError('worktree_feature_dirty', `Feature is dirty: ${parentStatus || childStatus}.`);
  const featureSha = gitText(featureRoot, ['rev-parse', 'HEAD^{commit}']);
  const childReview = assertReviewedFeatureChild(featureRoot, featureSha);
  return { slug, featureRoot, branch, featureSha, ...childReview };
}

export function assertReviewedFeatureChild(featureRoot, featureSha) {
  const reviewedGitlink = gitText(featureRoot, ['rev-parse', `${featureSha}:.decision-os`]);
  const childHead = gitText(resolve(featureRoot, '.decision-os'), ['rev-parse', 'HEAD^{commit}']);
  // WHAT: Bind the reviewed parent gitlink to the child checkout that will be published.
  // WHY: A clean feature parent cannot deliver child bytes that differ from its reviewed tree.
  if (reviewedGitlink !== childHead) {
    throw new WorktreeCliError('worktree_feature_child_mismatch', `Feature child ${childHead} does not match reviewed gitlink ${reviewedGitlink}.`);
  }
  return { reviewedGitlink, childHead };
}

function childSourceFromReviewedParent(feature) {
  const source = git(feature.featureRoot, ['config', '--blob', `${feature.featureSha}:.gitmodules`, '--get', 'submodule..decision-os.url'], { accepted: [0, 1] }).stdout;
  // WHAT: Require the child source recorded by the reviewed parent tree.
  // WHY: Integration must publish only to the source delivered with the feature rather than a caller-selected remote.
  if (!source) throw new WorktreeCliError('worktree_feature_child_source_missing', 'Reviewed parent .gitmodules has no .decision-os source.');
  return source;
}

function sourceDevTip(childRoot, source) {
  const listing = git(childRoot, ['ls-remote', '--heads', source, 'refs/heads/dev'], { raw: true });
  const tip = listing.stdout.trim().split(/\s+/)[0] ?? '';
  // WHAT: Require one full source dev object before child publication.
  // WHY: A lease cannot protect a missing or malformed source branch observation.
  if (!/^[a-f0-9]{40,64}$/.test(tip)) {
    throw new WorktreeCliError('worktree_feature_child_source_dev_missing', `Child source ${source} has no refs/heads/dev tip.`);
  }
  return tip;
}

export function admitPublishedParentDev({ devSha, publishedDevSha, decisionOsGitlink }) {
  // WHAT: Admit only the exact local parent dev commit currently published by origin.
  // WHY: Child publication must not make an unreviewed local parent baseline externally visible.
  if (devSha !== publishedDevSha) {
    throw new WorktreeCliError('worktree_dev_unpublished', `Local dev ${devSha} differs from origin/dev ${publishedDevSha}.`);
  }
  return { devSha, publishedDevSha, decisionOsGitlink };
}

function assertPublishedParentDev() {
  assertCanonicalDevRegistration();
  git(devRoot, ['fetch', 'origin', 'dev'], { timeout: 180_000 });
  const devSha = gitText(devRoot, ['rev-parse', 'HEAD^{commit}']);
  const publishedDevSha = gitText(devRoot, ['rev-parse', 'origin/dev^{commit}']);
  return admitPublishedParentDev({
    devSha,
    publishedDevSha,
    decisionOsGitlink: gitText(devRoot, ['rev-parse', `${devSha}:.decision-os`]),
  });
}

export function publishFeatureChild(feature, parentAdmission) {
  const childRoot = resolve(feature.featureRoot, '.decision-os');
  const source = childSourceFromReviewedParent(feature);
  const configuredSource = gitText(childRoot, ['remote', 'get-url', 'origin']);
  // WHAT: Reject a child checkout whose origin differs from the reviewed parent source.
  // WHY: A local remote override would redirect a tool-owned publication away from the reviewed destination.
  if (configuredSource !== source) {
    throw new WorktreeCliError('worktree_feature_child_source_override', `Feature child origin ${configuredSource} does not match reviewed source ${source}.`);
  }
  const observedSourceDevSha = sourceDevTip(childRoot, source);
  git(childRoot, ['fetch', 'origin', 'dev'], { timeout: 180_000 });
  const fetchedSourceDevSha = gitText(childRoot, ['rev-parse', 'origin/dev^{commit}']);
  // WHAT: Require the fetched configured source tip to equal the leased direct source observation.
  // WHY: Publication must not proceed when source observation and configured remote resolution diverge.
  if (fetchedSourceDevSha !== observedSourceDevSha) {
    throw new WorktreeCliError('worktree_feature_child_source_changed', `Fetched child source ${fetchedSourceDevSha} differs from observed ${observedSourceDevSha}.`);
  }
  const canonicalAncestor = git(childRoot, ['merge-base', '--is-ancestor', parentAdmission.decisionOsGitlink, feature.childHead], { accepted: [0, 1] }).status === 0;
  // WHAT: Require the reviewed child to descend from canonical dev's reviewed gitlink.
  // WHY: A feature cannot publish a child history that omits its admitted parent baseline.
  if (!canonicalAncestor) {
    throw new WorktreeCliError(
      'worktree_feature_child_canonical_ancestry_invalid',
      `Feature child ${feature.childHead} does not descend from canonical child ${parentAdmission.decisionOsGitlink}.`,
      2,
      `Rebase the feature worktree onto the latest dev with "git rebase dev" from ${feature.featureRoot}, resolve any conflicts, then run integration again.`,
    );
  }
  const sourceAncestor = git(childRoot, ['merge-base', '--is-ancestor', observedSourceDevSha, feature.childHead], { accepted: [0, 1] }).status === 0;
  // WHAT: Require the reviewed child to contain the observed source dev history.
  // WHY: Publishing a stale child feature would replace independently published source work.
  if (!sourceAncestor) {
    throw new WorktreeCliError('worktree_feature_child_stale_feature', `Feature child ${feature.childHead} does not descend from source dev ${observedSourceDevSha}.`);
  }
  // WHAT: Publish the reviewed child through one leased push with a distinct generic failure boundary.
  // WHY: Transport, authentication, and permission failures must not be misreported as a verified lease race.
  try {
    run('git', [
      'push', `--force-with-lease=refs/heads/dev:${observedSourceDevSha}`, source,
      `${feature.childHead}:refs/heads/dev`,
    ], {
      cwd: childRoot,
      timeout: 180_000,
      code: 'worktree_feature_child_publication_failed',
    });
  } catch (error) {
    // WHAT: Inspect the child source after a rejected push before assigning a stable failure category.
    // WHY: Only fresh remote evidence can distinguish a lease race from another publication failure.
    let currentSourceDevSha = '';
    // WHAT: Preserve the original publication failure when the source cannot be observed again.
    // WHY: A second transport failure supplies no evidence that the remote tip advanced.
    try {
      currentSourceDevSha = sourceDevTip(childRoot, source);
    } catch {
      // WHAT: Propagate the original publication failure when post-failure observation is unavailable.
      // WHY: The verified evidence does not authorize a remote-advance diagnosis.
      throw error;
    }
    // WHAT: Reclassify the push rejection only when the directly observed source tip actually advanced.
    // WHY: The stable remote-advance code must identify a proven lease conflict rather than any push failure.
    if (currentSourceDevSha !== observedSourceDevSha) {
      throw new WorktreeCliError('worktree_feature_child_remote_advanced', `Child source advanced from ${observedSourceDevSha} to ${currentSourceDevSha} before publication.`);
    }
    throw error;
  }
  git(childRoot, ['fetch', 'origin', 'dev'], { timeout: 180_000 });
  const refetchedSourceDevSha = gitText(childRoot, ['rev-parse', 'origin/dev^{commit}']);
  // WHAT: Require the source refetch to resolve to the exact reviewed child SHA before parent merge.
  // WHY: The parent merge must never reference a child object whose publication is only assumed.
  if (refetchedSourceDevSha !== feature.childHead) {
    throw new WorktreeCliError('worktree_feature_child_publication_mismatch', `Published child ${refetchedSourceDevSha} does not equal reviewed ${feature.childHead}.`);
  }
  return {
    reviewedParentSha: feature.featureSha,
    reviewedGitlink: feature.reviewedGitlink,
    childHead: feature.childHead,
    canonicalDevGitlink: parentAdmission.decisionOsGitlink,
    source,
    observedSourceDevSha,
    refetchedSourceDevSha,
    lease: `refs/heads/dev:${observedSourceDevSha}`,
  };
}

function parseJsonOutput(text, code) {
  try {
    return JSON.parse(text.trim().split('\n').at(-1) ?? '');
  } catch {
    throw new WorktreeCliError(code, `Expected JSON output, received: ${text.trim()}`, 3);
  }
}

export function integrateFeature(name) {
  const feature = assertFeatureReady(name);
  assertPublishedParentDev();
  initDev({ deferLegacyRelay: true });
  const parentAdmission = assertPublishedParentDev();
  const childPublication = publishFeatureChild(feature, parentAdmission);
  const mergeMessage = `Merge ${feature.slug}`;
  git(devRoot, [
    'merge', '--no-ff', feature.featureSha,
    '-m', mergeMessage,
    '-m', `WHAT: Merge the exact reviewed ${feature.branch} feature into canonical dev.`,
    '-m', 'WHY: Deliver the verified feature through the repository-owned worktree lifecycle.',
  ], { timeout: 180_000 });
  initDev();
  const check = run(process.execPath, [resolve(devRoot, 'bin', 'decision-os-dev-integration-check.mjs'), '--feature', feature.featureSha, '--json'], {
    cwd: devRoot,
    timeout: 180_000,
    code: 'worktree_integration_check_failed',
  });
  const admission = parseJsonOutput(check.stdout, 'worktree_integration_receipt_invalid');
  // WHAT: Require the fixed integration checker to admit the exact merged dev SHA.
  // WHY: Push and cleanup authority belongs only to a successful immutable receipt.
  if (admission.ok !== true || !/^[a-f0-9]{40,64}$/.test(String(admission.devSha ?? ''))) {
    throw new WorktreeCliError('worktree_integration_rejected', JSON.stringify(admission));
  }
  run('git', ['push', 'origin', `${admission.devSha}:refs/heads/dev`], {
    cwd: devRoot,
    timeout: 180_000,
    env: { ...process.env, GIT_SSH_COMMAND: `ssh -i ${resolve(homedir(), '.ssh', 'id_jb_wise')} -o IdentitiesOnly=yes` },
    code: 'worktree_dev_push_failed',
  });
  git(primaryRoot, ['worktree', 'remove', '--force', feature.featureRoot], { timeout: 180_000 });
  git(primaryRoot, ['branch', '-D', feature.branch]);
  return {
    ok: true,
    command: 'integrate',
    name: feature.slug,
    featureSha: feature.featureSha,
    devSha: admission.devSha,
    decisionOsGitlink: admission.decisionOsGitlink,
    parentAdmission,
    childPublication,
    pushedRef: 'refs/heads/dev',
    cleanedWorktree: feature.featureRoot,
    deletedBranch: feature.branch,
    admission,
  };
}

export function cleanupMergedFeature(name) {
  const slug = assertFeatureName(name);
  const branch = `feature/${slug}`;
  const branchRef = `refs/heads/${branch}`;
  const branchExists = git(primaryRoot, ['show-ref', '--verify', '--quiet', branchRef], { accepted: [0, 1] }).status === 0;
  // WHAT: Require the exact local feature branch selected for cleanup.
  // WHY: Cleanup never infers a similarly named branch or reports absent state as completed work.
  if (!branchExists) throw new WorktreeCliError('worktree_cleanup_branch_missing', `${branch} does not exist.`);
  const merged = git(primaryRoot, ['merge-base', '--is-ancestor', branchRef, 'refs/heads/dev'], { accepted: [0, 1] }).status === 0;
  // WHAT: Delete only a feature branch fully contained by canonical dev.
  // WHY: An unmerged branch remains a required recovery boundary.
  if (!merged) throw new WorktreeCliError('worktree_cleanup_unmerged', `${branch} is not contained by dev.`);
  const owners = registeredWorktrees().filter((record) => record.branch === branchRef);
  // WHAT: Reject ambiguous duplicate ownership before removing a registered feature checkout.
  // WHY: Cleanup must target one exact worktree path.
  if (owners.length > 1) throw new WorktreeCliError('worktree_cleanup_ambiguous', `${branch} owns ${owners.length} worktrees.`);
  let removedWorktree = '';
  // WHAT: Remove the one clean registered feature checkout before deleting its branch.
  // WHY: Git cannot delete a branch while a linked worktree owns it.
  if (owners.length === 1) {
    const featureRoot = owners[0].path;
    const parentStatus = exactStatus(featureRoot, true);
    const childRoot = resolve(featureRoot, '.decision-os');
    const childStatus = existsSync(resolve(childRoot, '.git')) ? exactStatus(childRoot, false) : '';
    // WHAT: Preserve every dirty parent or child feature checkout.
    // WHY: Cleanup authority extends only to fully committed state already contained by dev.
    if (parentStatus || childStatus) throw new WorktreeCliError('worktree_cleanup_dirty', `Feature cleanup is dirty: ${parentStatus || childStatus}.`);
    git(primaryRoot, ['worktree', 'remove', '--force', featureRoot], { timeout: 180_000 });
    removedWorktree = featureRoot;
  }
  git(primaryRoot, ['branch', '-D', branch]);
  return { ok: true, command: 'cleanup', name: slug, branch, removedWorktree, devSha: gitText(devRoot, ['rev-parse', 'HEAD^{commit}']) };
}

export function statusReceipt() {
  assertCanonicalDevRegistration();
  const dependencies = dependencyContracts.map((contract) => {
    const path = resolve(devRoot, contract.name, 'node_modules');
    return { package: contract.name, path, realDirectory: pathExists(path) && !lstatSync(path).isSymbolicLink(), proof: existsSync(resolve(path, contract.proof)) };
  });
  return {
    ok: true,
    command: 'status',
    devRoot,
    devSha: gitText(devRoot, ['rev-parse', 'HEAD^{commit}']),
    status: exactStatus(devRoot, true),
    dependencies,
    decisionOsGitlink: gitText(devRoot, ['rev-parse', 'HEAD:.decision-os']),
  };
}

function withOperationLock(operation) {
  const commonDirectory = resolve(primaryRoot, gitText(primaryRoot, ['rev-parse', '--git-common-dir']));
  const lockFile = resolve(commonDirectory, 'decision-os-worktree.lock');
  let descriptor;
  try {
    descriptor = openSync(lockFile, 'wx');
    writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, cwd: process.cwd(), startedAt: new Date().toISOString() })}\n`);
  } catch (error) {
    // WHAT: Report one active lifecycle owner instead of running concurrent Git mutations.
    // WHY: Worktree creation, merge, child installation, push, and cleanup share repository-global refs and paths.
    if (error?.code === 'EEXIST') {
      let owner = {};
      try { owner = JSON.parse(readFileSync(lockFile, 'utf8')); } catch { owner = {}; }
      let active = false;
      try {
        process.kill(Number(owner.pid), 0);
        active = Number.isInteger(Number(owner.pid)) && Number(owner.pid) > 0;
      } catch {
        active = false;
      }
      // WHAT: Reject a lock owned by a live process.
      // WHY: An active lifecycle transaction must reach its own terminal cleanup boundary.
      if (active) throw new WorktreeCliError('worktree_operation_locked', `Worktree operation is owned by PID ${owner.pid}.`);
      unlinkSync(lockFile);
      return withOperationLock(operation);
    }
    throw error;
  }
  try {
    return operation();
  } finally {
    closeSync(descriptor);
    unlinkSync(lockFile);
  }
}

function usage() {
  return 'Usage: decision-os-worktree <init-dev|status|create|integrate|cleanup> [feature-name] --json';
}

/**
 * WHAT: Serializes one worktree failure with its exact evidence and defined recovery instruction.
 * WHY: CLI callers need stable machine-readable recovery output without parsing prose from the error message.
 */
export function worktreeFailureReceipt(error) {
  const known = error instanceof WorktreeCliError;
  return {
    ok: false,
    code: known ? error.code : 'worktree_failed',
    message: error instanceof Error ? error.message : String(error),
    // WHAT: Include a recovery instruction only when the exact failure defines one.
    // WHY: Machine-readable callers must not infer mutation steps from a generic error category.
    ...(known && error.instruction ? { instruction: error.instruction } : {}),
  };
}

export function runCli(argv = process.argv.slice(2)) {
  try {
    const command = argv[0];
    const json = argv.at(-1) === '--json';
    // WHAT: Require the fixed machine-readable command form.
    // WHY: One JSON contract prevents interactive prompts and ambiguous partial setup.
    if (!json) throw new WorktreeCliError('worktree_usage', usage());
    let receipt;
    // WHAT: Dispatch the canonical dev initialization command without a feature argument.
    // WHY: Dev provisioning is repository-wide and owns no feature branch.
    if (command === 'init-dev' && argv.length === 2) receipt = withOperationLock(() => initDev());
    // WHAT: Dispatch the read-only canonical status command without a feature argument.
    // WHY: Operators need one stable diagnostic that performs no repair.
    else if (command === 'status' && argv.length === 2) receipt = statusReceipt();
    // WHAT: Dispatch one feature creation with its exact portable slug.
    // WHY: Branch, directory, child branch, and receipt must share one identity.
    else if (command === 'create' && argv.length === 3) receipt = withOperationLock(() => createFeature(argv[1]));
    // WHAT: Dispatch one exact feature integration and cleanup transaction.
    // WHY: Merge, admission, push, and cleanup must share one immutable feature identity.
    else if (command === 'integrate' && argv.length === 3) receipt = withOperationLock(() => integrateFeature(argv[1]));
    // WHAT: Dispatch recovery cleanup for one feature already contained by canonical dev.
    // WHY: Interrupted post-push cleanup must remain available without manual Git mutation.
    else if (command === 'cleanup' && argv.length === 3) receipt = withOperationLock(() => cleanupMergedFeature(argv[1]));
    else throw new WorktreeCliError('worktree_usage', usage());
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
    return 0;
  } catch (error) {
    const known = error instanceof WorktreeCliError;
    process.stderr.write(`${JSON.stringify(worktreeFailureReceipt(error))}\n`);
    return known ? error.exitCode : 3;
  }
}

// WHAT: Execute only when invoked as the CLI entrypoint.
// WHY: Tests import lifecycle functions without mutating real worktrees.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = runCli();
}
