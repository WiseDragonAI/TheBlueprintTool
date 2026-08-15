/**
 * WHAT: Binds the reviewed parent gitlink to the feature child checkout head.
 * WHY: A clean parent must not deliver child bytes outside its reviewed tree.
 */
import { resolve } from 'node:path';
import { gitText } from './git-text.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';

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
