/**
 * WHAT: Reads and validates the direct child source dev tip.
 * WHY: The publication lease needs one complete immutable remote observation.
 */
import { git } from './git.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';

export function sourceDevTip(childRoot, source) {
  const listing = git(childRoot, ['ls-remote', '--heads', source, 'refs/heads/dev'], { raw: true });
  const tip = listing.stdout.trim().split(/\s+/)[0] ?? '';
  // WHAT: Require one full source dev object before child publication.
  // WHY: A lease cannot protect a missing or malformed source branch observation.
  if (!/^[a-f0-9]{40,64}$/.test(tip)) {
    throw new WorktreeCliError('worktree_feature_child_source_dev_missing', `Child source ${source} has no refs/heads/dev tip.`);
  }
  return tip;
}
