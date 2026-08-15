/**
 * WHAT: Controls canonical dev provisioning from registration through cleanliness receipt.
 * WHY: One operation lifecycle must own generated-state repair, dependency installation, child setup, and final admission.
 */
import { existsSync, lstatSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { dependencyContracts, devRoot } from '../config.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';
import { assertCanonicalDevRegistration } from '../helpers/assert-canonical-dev-registration.mjs';
import { exactStatus } from '../helpers/exact-status.mjs';
import { gitText } from '../helpers/git-text.mjs';
import { installDevChild } from '../helpers/install-dev-child.mjs';
import { installRealDependencies } from '../helpers/install-real-dependencies.mjs';
import { pathExists } from '../helpers/path-exists.mjs';
import { repairKnownGeneratedSearchIgnore } from '../helpers/repair-generated-search-ignore.mjs';
import { writeDevManifest } from '../helpers/write-dev-manifest.mjs';

export function initDev(options = {}) {
  assertCanonicalDevRegistration();
  const repairedGeneratedPaths = repairKnownGeneratedSearchIgnore(devRoot);
  const ignoreRules = readFileSync(resolve(devRoot, '.gitignore'), 'utf8').split('\n');
  const relayDependenciesIgnored = ignoreRules.includes('federation-relay/node_modules') || ignoreRules.includes('federation-relay/node_modules/');
  const dependencies = dependencyContracts.map((contract) => {
    const dependencyPath = resolve(devRoot, contract.name, 'node_modules');
    // WHAT: Defer only the legacy relay dependency symlink until the integrating feature installs its repository ignore rule.
    // WHY: The bootstrap integration must become naturally clean without a temporary Git exclusion.
    if (options.deferLegacyRelay === true && contract.name === 'federation-relay' && !relayDependenciesIgnored) {
      // WHAT: Remove only the known relay dependency symlink whose target remains owned by the primary checkout.
      // WHY: A symlink is not matched by the historical trailing-slash ignore rule and blocks the pre-merge cleanliness gate.
      if (pathExists(dependencyPath) && lstatSync(dependencyPath).isSymbolicLink()) unlinkSync(dependencyPath);
      // WHAT: Reject unexplained real relay dependencies before the repository owns their ignore boundary.
      // WHY: Bootstrap must not hide or delete an existing real installation.
      if (pathExists(dependencyPath)) throw new WorktreeCliError('worktree_dependency_directory_invalid', `${dependencyPath} exists before its ignore rule.`);
      return { package: contract.name, action: 'deferred', path: dependencyPath };
    }
    return installRealDependencies(resolve(devRoot, contract.name), contract.proof);
  });
  const decisionOsGitlink = installDevChild();
  const status = exactStatus(devRoot, true);
  // WHAT: Reject every remaining parent mutation after canonical provisioning.
  // WHY: Dev is the immutable feature baseline and integration target, not a general working directory.
  if (status) throw new WorktreeCliError('worktree_dev_dirty', `Canonical dev is dirty: ${status.split('\n').join(', ')}.`);
  const receipt = {
    ok: true,
    command: 'init-dev',
    devRoot,
    devSha: gitText(devRoot, ['rev-parse', 'HEAD^{commit}']),
    decisionOsGitlink,
    dependencies,
    repairedGeneratedPaths,
  };
  return { ...receipt, manifest: writeDevManifest(receipt) };
}
