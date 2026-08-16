/**
 * WHAT: Builds the read-only canonical dev status receipt.
 * WHY: Operators need one bounded diagnostic without triggering setup repair.
 */
import { existsSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { dependencyContracts, devRoot } from '../config.mjs';
import { assertCanonicalDevRegistration } from '../helpers/assert-canonical-dev-registration.mjs';
import { exactStatus } from '../helpers/exact-status.mjs';
import { gitText } from '../helpers/git-text.mjs';
import { pathExists } from '../helpers/path-exists.mjs';

export function statusReceipt() {
  assertCanonicalDevRegistration();
  const dependencies = dependencyContracts.map((contract) => {
    const path = resolve(devRoot, contract.name, 'node_modules');
    return { package: contract.name, path, realDirectory: pathExists(path) && !lstatSync(path).isSymbolicLink(), proof: existsSync(resolve(path, contract.proof)) };
  });
  return {
    ok: true,
    command: 'status',
    devRoot,
    devSha: gitText(devRoot, ['rev-parse', 'HEAD^{commit}']),
    status: exactStatus(devRoot, true),
    dependencies,
    decisionOsGitlink: gitText(devRoot, ['rev-parse', 'HEAD:.decision-os']),
  };
}
