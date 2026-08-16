/**
 * WHAT: Admits one exact clean feature worktree and its reviewed child binding.
 * WHY: Integration must operate only on committed bytes owned by the selected branch and checkout.
 */
import { resolve } from 'node:path';
import { primaryRoot } from '../config.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';
import { assertFeatureName } from './assert-feature-name.mjs';
import { assertReviewedFeatureChild } from './assert-reviewed-feature-child.mjs';
import { exactStatus } from './exact-status.mjs';
import { gitText } from './git-text.mjs';
import { registeredWorktrees } from './registered-worktrees.mjs';

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
