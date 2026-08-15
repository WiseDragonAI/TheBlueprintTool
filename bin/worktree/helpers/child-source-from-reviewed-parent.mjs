/**
 * WHAT: Resolves the child source recorded by the reviewed parent tree.
 * WHY: Publication must not accept a caller-selected or checkout-only destination.
 */
import { git } from './git.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';

export function childSourceFromReviewedParent(feature) {
  const source = git(feature.featureRoot, ['config', '--blob', `${feature.featureSha}:.gitmodules`, '--get', 'submodule..decision-os.url'], { accepted: [0, 1] }).stdout;
  // WHAT: Require the child source recorded by the reviewed parent tree.
  // WHY: Integration must publish only to the source delivered with the feature rather than a caller-selected remote.
  if (!source) throw new WorktreeCliError('worktree_feature_child_source_missing', 'Reviewed parent .gitmodules has no .decision-os source.');
  return source;
}
