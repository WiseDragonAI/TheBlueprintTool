/**
 * WHAT: Controls creation of one clean feature parent and child checkout.
 * WHY: Feature identity, baseline, dependency links, and rollback must settle as one lifecycle.
 */
import { resolve } from 'node:path';
import { devRoot, primaryRoot } from '../config.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';
import { assertFeatureName } from '../helpers/assert-feature-name.mjs';
import { exactStatus } from '../helpers/exact-status.mjs';
import { git } from '../helpers/git.mjs';
import { gitText } from '../helpers/git-text.mjs';
import { linkFeatureDependencies } from '../helpers/link-feature-dependencies.mjs';
import { pathExists } from '../helpers/path-exists.mjs';
import { initDev } from './init-dev.mjs';

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
