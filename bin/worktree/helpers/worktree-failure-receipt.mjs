/**
 * WHAT: Serializes one worktree failure into the stable CLI error receipt.
 * WHY: Machine callers need exact recovery evidence without parsing prose.
 */
import { WorktreeCliError } from '../worktree-cli-error.mjs';

export function worktreeFailureReceipt(error) {
  const known = error instanceof WorktreeCliError;
  return {
    ok: false,
    code: known ? error.code : 'worktree_failed',
    message: error instanceof Error ? error.message : String(error),
    // WHAT: Include a recovery instruction only when the exact failure defines one.
    // WHY: Machine-readable callers must not infer mutation steps from a generic error category.
    ...(known && error.instruction ? { instruction: error.instruction } : {}),
  };
}
