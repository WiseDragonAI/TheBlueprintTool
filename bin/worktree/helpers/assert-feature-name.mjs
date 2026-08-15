/**
 * WHAT: Validates the portable slug shared by feature refs and paths.
 * WHY: One strict identity prevents path traversal and ambiguous branch ownership.
 */
import { WorktreeCliError } from '../worktree-cli-error.mjs';

export function assertFeatureName(name) {
  // WHAT: Admit one portable feature slug without path or ref syntax.
  // WHY: One slug must safely own the branch, worktree directory, child branch, and JSON receipt.
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(name)) {
    throw new WorktreeCliError('worktree_name_invalid', `Invalid feature name: ${name || '(empty)'}.`);
  }
  return name;
}
