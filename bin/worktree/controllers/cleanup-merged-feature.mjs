/**
 * WHAT: Controls safe cleanup of one feature already contained by canonical dev.
 * WHY: Interrupted delivery cleanup must preserve every unmerged or dirty recovery boundary.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { devRoot, primaryRoot } from '../config.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';
import { assertFeatureName } from '../helpers/assert-feature-name.mjs';
import { exactStatus } from '../helpers/exact-status.mjs';
import { git } from '../helpers/git.mjs';
import { gitText } from '../helpers/git-text.mjs';
import { registeredWorktrees } from '../helpers/registered-worktrees.mjs';

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
