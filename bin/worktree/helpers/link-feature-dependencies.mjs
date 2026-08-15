/**
 * WHAT: Links one feature checkout to canonical dev dependency owners.
 * WHY: Temporary features must reuse only verified dev dependencies and preserve noncanonical entries.
 */
import { existsSync, lstatSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { dependencyContracts, devRoot } from '../config.mjs';
import { pathExists } from './path-exists.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';

export function linkFeatureDependencies(featureRoot) {
  return dependencyContracts.map((contract) => {
    const target = resolve(devRoot, contract.name, 'node_modules');
    const link = resolve(featureRoot, contract.name, 'node_modules');
    // WHAT: Reject an unavailable canonical dependency owner.
    // WHY: Feature worktrees must never link to the primary checkout or another temporary feature.
    if (!existsSync(resolve(target, contract.proof))) throw new WorktreeCliError('worktree_dev_dependencies_missing', `Canonical dependencies are missing for ${contract.name}.`);
    // WHAT: Preserve an exact canonical feature dependency link.
    // WHY: Repeated setup must not replace a valid worktree dependency boundary.
    if (pathExists(link) && lstatSync(link).isSymbolicLink() && realpathSync(link) === realpathSync(target)) {
      return { package: contract.name, path: link, target, action: 'retained' };
    }
    // WHAT: Reject every existing noncanonical dependency entry.
    // WHY: Creation must not destroy feature-owned installations or links from another checkout.
    if (pathExists(link)) throw new WorktreeCliError('worktree_feature_dependencies_invalid', `${link} already exists and is not canonical.`);
    symlinkSync(target, link, 'dir');
    return { package: contract.name, path: link, target, action: 'linked' };
  });
}
