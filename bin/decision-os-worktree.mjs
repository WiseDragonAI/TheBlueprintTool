#!/usr/bin/env node
/**
 * WHAT: Exposes the canonical Decision OS worktree lifecycle CLI and its tested public contracts.
 * WHY: The executable must stay below 200 LOC while controllers own behavior and helpers own implementation work.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from './worktree/controllers/run-cli.mjs';

export { WorktreeCliError } from './worktree/worktree-cli-error.mjs';
export { assertFeatureName } from './worktree/helpers/assert-feature-name.mjs';
export { repairKnownGeneratedSearchIgnore } from './worktree/helpers/repair-generated-search-ignore.mjs';
export { installRealDependencies } from './worktree/helpers/install-real-dependencies.mjs';
export { initDev } from './worktree/controllers/init-dev.mjs';
export { createFeature } from './worktree/controllers/create-feature.mjs';
export { assertFeatureReady } from './worktree/helpers/assert-feature-ready.mjs';
export { assertReviewedFeatureChild } from './worktree/helpers/assert-reviewed-feature-child.mjs';
export { admitPublishedParentDev } from './worktree/helpers/admit-published-parent-dev.mjs';
export { publishFeatureChild } from './worktree/controllers/publish-feature-child.mjs';
export { integrateFeature } from './worktree/controllers/integrate-feature.mjs';
export { cleanupMergedFeature } from './worktree/controllers/cleanup-merged-feature.mjs';
export { statusReceipt } from './worktree/controllers/status-receipt.mjs';
export { worktreeFailureReceipt } from './worktree/helpers/worktree-failure-receipt.mjs';
export { runCli } from './worktree/controllers/run-cli.mjs';

// WHAT: Execute only when invoked as the CLI entrypoint.
// WHY: Tests import lifecycle functions without mutating real worktrees.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = runCli();
}
