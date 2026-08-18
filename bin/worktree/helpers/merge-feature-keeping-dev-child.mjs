/**
 * WHAT: Merges one feature while restoring canonical dev's Decision OS gitlink before the merge commit.
 * WHY: Feature worktree Decision OS state is disposable and must never block or alter parent-code integration.
 */
import { WorktreeCliError } from '../worktree-cli-error.mjs';
import { git } from './git.mjs';
import { gitText } from './git-text.mjs';

export function mergeFeatureKeepingDevChild(root, feature, devGitlink) {
  const merge = git(root, ['merge', '--no-commit', '--no-ff', feature.featureSha], { accepted: [0, 1], timeout: 180_000 });
  const conflicts = gitText(root, ['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean);
  const nonChildConflicts = conflicts.filter((path) => path !== '.decision-os');
  // WHAT: Reject every unresolved merge conflict outside the disposable Decision OS gitlink.
  // WHY: The tool has authority to select dev only for .decision-os, not to decide source-code conflicts.
  if (nonChildConflicts.length > 0) {
    throw new WorktreeCliError('worktree_feature_merge_conflict', `Feature merge has non-.decision-os conflicts: ${nonChildConflicts.join(', ')}.`);
  }
  // WHAT: Reject an unexplained nonzero merge settlement without a Decision OS conflict.
  // WHY: Only the known disposable gitlink conflict has an automatic resolution policy.
  if (merge.status !== 0 && !conflicts.includes('.decision-os')) {
    throw new WorktreeCliError('worktree_feature_merge_failed', merge.stderr.trim() || merge.stdout.trim() || 'Feature merge failed.');
  }
  git(root, ['checkout', 'HEAD', '--', '.decision-os']);
  git(root, [
    'commit',
    '-m', `Merge ${feature.slug}`,
    '-m', `WHAT: Merge the exact reviewed ${feature.branch} source while retaining canonical dev Decision OS state.`,
    '-m', 'WHY: Feature worktree Decision OS state is disposable and dev remains its sole integration owner.',
  ]);
  const integratedGitlink = gitText(root, ['rev-parse', 'HEAD:.decision-os']);
  // WHAT: Require the merge commit to retain the exact pre-merge dev gitlink.
  // WHY: Successful conflict resolution must be proven from the committed tree rather than assumed from checkout state.
  if (integratedGitlink !== devGitlink) {
    throw new WorktreeCliError('worktree_dev_child_replaced', `Integrated gitlink ${integratedGitlink} differs from retained dev gitlink ${devGitlink}.`);
  }
  return {
    strategy: 'keep-dev',
    incomingGitlink: feature.incomingGitlink,
    retainedGitlink: devGitlink,
    conflictsDiscarded: conflicts.filter((path) => path === '.decision-os'),
  };
}
