/**
 * WHAT: Admits canonical parent dev only when local and published commits match.
 * WHY: Child publication must never expose work based on an unpublished parent baseline.
 */
import { WorktreeCliError } from '../worktree-cli-error.mjs';

export function admitPublishedParentDev({ devSha, publishedDevSha, decisionOsGitlink }) {
  // WHAT: Admit only the exact local parent dev commit currently published by origin.
  // WHY: Child publication must not make an unreviewed local parent baseline externally visible.
  if (devSha !== publishedDevSha) {
    throw new WorktreeCliError('worktree_dev_unpublished', `Local dev ${devSha} differs from origin/dev ${publishedDevSha}.`);
  }
  return { devSha, publishedDevSha, decisionOsGitlink };
}
