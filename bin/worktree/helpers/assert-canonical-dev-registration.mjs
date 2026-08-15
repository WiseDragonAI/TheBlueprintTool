/**
 * WHAT: Admits the single canonical checkout that owns the dev branch.
 * WHY: Feature creation and integration cannot use an ambiguous dev worktree.
 */
import { realpathSync } from 'node:fs';
import { devRoot } from '../config.mjs';
import { registeredWorktrees } from './registered-worktrees.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';

export function assertCanonicalDevRegistration() {
  const owners = registeredWorktrees().filter((record) => record.branch === 'refs/heads/dev');
  // WHAT: Require one exact persistent dev branch owner at the canonical path.
  // WHY: Feature baselines and integration cannot depend on an ambiguous or transient dev checkout.
  if (owners.length !== 1 || realpathSync(owners[0].path) !== realpathSync(devRoot)) {
    throw new WorktreeCliError('worktree_dev_registration_invalid', `Expected refs/heads/dev only at ${devRoot}.`);
  }
}
