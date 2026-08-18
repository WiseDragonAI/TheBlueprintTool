/**
 * WHAT: Admits one exact clean feature parent while recording its disposable incoming child gitlink.
 * WHY: Integration delivers committed parent source and always retains canonical dev Decision OS state.
 */
import { resolve } from 'node:path';
import { primaryRoot } from '../config.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';
import { assertFeatureName } from './assert-feature-name.mjs';
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
  // WHAT: Require committed parent source state while ignoring the disposable child checkout.
  // WHY: Integration delivers feature source but always retains canonical dev Decision OS state.
  if (parentStatus) throw new WorktreeCliError('worktree_feature_dirty', `Feature is dirty: ${parentStatus}.`);
  const featureSha = gitText(featureRoot, ['rev-parse', 'HEAD^{commit}']);
  const incomingGitlink = gitText(featureRoot, ['rev-parse', `${featureSha}:.decision-os`]);
  return { slug, featureRoot, branch, featureSha, incomingGitlink };
}
