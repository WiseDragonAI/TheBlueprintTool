/**
 * WHAT: Dispatches one canonical worktree command and serializes its terminal receipt.
 * WHY: The executable boundary must remain a thin goal-oriented dispatcher over lifecycle controllers.
 */
import { usage } from '../config.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';
import { withOperationLock } from '../helpers/with-operation-lock.mjs';
import { worktreeFailureReceipt } from '../helpers/worktree-failure-receipt.mjs';
import { cleanupMergedFeature } from './cleanup-merged-feature.mjs';
import { createFeature } from './create-feature.mjs';
import { initDev } from './init-dev.mjs';
import { integrateFeature } from './integrate-feature.mjs';
import { statusReceipt } from './status-receipt.mjs';

export function runCli(argv = process.argv.slice(2)) {
  try {
    const command = argv[0];
    const json = argv.at(-1) === '--json';
    // WHAT: Require the fixed machine-readable command form.
    // WHY: One JSON contract prevents interactive prompts and ambiguous partial setup.
    if (!json) throw new WorktreeCliError('worktree_usage', usage());
    let receipt;
    // WHAT: Dispatch the canonical dev initialization command without a feature argument.
    // WHY: Dev provisioning is repository-wide and owns no feature branch.
    if (command === 'init-dev' && argv.length === 2) receipt = withOperationLock(() => initDev());
    // WHAT: Dispatch the read-only canonical status command without a feature argument.
    // WHY: Operators need one stable diagnostic that performs no repair.
    else if (command === 'status' && argv.length === 2) receipt = statusReceipt();
    // WHAT: Dispatch one feature creation with its exact portable slug.
    // WHY: Branch, directory, child branch, and receipt must share one identity.
    else if (command === 'create' && argv.length === 3) receipt = withOperationLock(() => createFeature(argv[1]));
    // WHAT: Dispatch one exact feature integration and cleanup transaction.
    // WHY: Merge, admission, push, and cleanup must share one immutable feature identity.
    else if (command === 'integrate' && argv.length === 3) receipt = withOperationLock(() => integrateFeature(argv[1]));
    // WHAT: Dispatch recovery cleanup for one feature already contained by canonical dev.
    // WHY: Interrupted post-push cleanup must remain available without manual Git mutation.
    else if (command === 'cleanup' && argv.length === 3) receipt = withOperationLock(() => cleanupMergedFeature(argv[1]));
    else throw new WorktreeCliError('worktree_usage', usage());
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
    return 0;
  } catch (error) {
    const known = error instanceof WorktreeCliError;
    process.stderr.write(`${JSON.stringify(worktreeFailureReceipt(error))}\n`);
    return known ? error.exitCode : 3;
  }
}
