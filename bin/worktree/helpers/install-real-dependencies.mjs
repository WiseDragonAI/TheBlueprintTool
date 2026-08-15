/**
 * WHAT: Installs one complete package-owned dependency directory without mutating symlink targets.
 * WHY: Canonical dev must own durable dependency bytes and preserve unexplained local state.
 */
import { copyFileSync, existsSync, lstatSync, mkdtempSync, renameSync, rmSync, unlinkSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { primaryRoot } from '../config.mjs';
import { pathExists } from './path-exists.mjs';
import { run } from './run.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';

export function installRealDependencies(packageRoot, proofRelative) {
  const dependencyPath = resolve(packageRoot, 'node_modules');
  // WHAT: Reuse one complete package-owned dependency directory.
  // WHY: Canonical dev setup must remain idempotent and avoid unnecessary package installation.
  if (pathExists(dependencyPath) && !lstatSync(dependencyPath).isSymbolicLink() && existsSync(resolve(dependencyPath, proofRelative))) {
    return { package: basename(packageRoot), action: 'retained', path: dependencyPath };
  }
  const stagingRoot = mkdtempSync(resolve(packageRoot, '.decision-os-dependencies-'));
  try {
    copyFileSync(resolve(packageRoot, 'package.json'), resolve(stagingRoot, 'package.json'));
    copyFileSync(resolve(packageRoot, 'package-lock.json'), resolve(stagingRoot, 'package-lock.json'));
    run('npm', ['ci', '--ignore-scripts', '--prefix', stagingRoot], {
      cwd: primaryRoot,
      timeout: 1_200_000,
      code: 'worktree_dependency_install_failed',
    });
    const stagedDependencies = resolve(stagingRoot, 'node_modules');
    // WHAT: Reject a package installation that lacks its package-specific runtime proof.
    // WHY: A partial install would fail after the canonical setup receipt was issued.
    if (!existsSync(resolve(stagedDependencies, proofRelative))) {
      throw new WorktreeCliError('worktree_dependency_install_incomplete', `Dependency proof is missing for ${basename(packageRoot)}.`);
    }
    // WHAT: Remove only an existing dependency symlink before installing the real package-owned directory.
    // WHY: Following the symlink could mutate dependencies owned by the primary checkout.
    if (pathExists(dependencyPath) && lstatSync(dependencyPath).isSymbolicLink()) unlinkSync(dependencyPath);
    // WHAT: Reject an incomplete real directory instead of deleting unexplained dependency bytes.
    // WHY: Setup repairs only the known symlink topology and preserves unknown local installations.
    if (pathExists(dependencyPath)) {
      throw new WorktreeCliError('worktree_dependency_directory_invalid', `${dependencyPath} is an incomplete real directory.`);
    }
    renameSync(stagedDependencies, dependencyPath);
    return { package: basename(packageRoot), action: 'installed', path: dependencyPath };
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}
