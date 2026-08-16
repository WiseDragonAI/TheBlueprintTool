/**
 * WHAT: Controls leased publication of the exact reviewed feature child commit.
 * WHY: Source identity, ancestry, lease races, transport failures, and refetch proof belong to one operation lifecycle.
 */
import { resolve } from 'node:path';
import { WorktreeCliError } from '../worktree-cli-error.mjs';
import { childSourceFromReviewedParent } from '../helpers/child-source-from-reviewed-parent.mjs';
import { git } from '../helpers/git.mjs';
import { gitText } from '../helpers/git-text.mjs';
import { run } from '../helpers/run.mjs';
import { sourceDevTip } from '../helpers/source-dev-tip.mjs';

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
