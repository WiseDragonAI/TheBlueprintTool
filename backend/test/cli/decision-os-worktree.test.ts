import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  assertFeatureName,
  installRealDependencies,
  repairKnownGeneratedSearchIgnore,
} from '../../../bin/decision-os-worktree.mjs';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function isCliError(error: unknown, code: string): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code: string }).code === code;
}

test('integration cleanup admits the verified worktree and feature branch after exact push', () => {
  const source = readFileSync(new URL('../../../bin/decision-os-worktree.mjs', import.meta.url), 'utf8');
  assert.match(source, /\['worktree', 'remove', '--force', feature\.featureRoot\]/);
  assert.match(source, /\['branch', '-D', feature\.branch\]/);
});

test('worktree feature names own one portable branch and directory identity', () => {
  assert.equal(assertFeatureName('canonical-worktree-cli'), 'canonical-worktree-cli');
  assert.throws(
    () => assertFeatureName('../dev'),
    (error: unknown) => isCliError(error, 'worktree_name_invalid'),
  );
});

test('canonical dependency installation replaces only the known symlink and preserves its target', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-worktree-dependencies-'));
  const packageRoot = join(root, 'backend');
  const sharedRoot = join(root, 'shared-node-modules');
  const fakeBin = join(root, 'bin');
  const previousPath = process.env.PATH;
  try {
    mkdirSync(packageRoot);
    mkdirSync(sharedRoot);
    mkdirSync(fakeBin);
    writeFileSync(join(packageRoot, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n');
    writeFileSync(join(packageRoot, 'package-lock.json'), '{"name":"fixture","version":"1.0.0","lockfileVersion":3,"packages":{}}\n');
    writeFileSync(join(sharedRoot, 'preserved.txt'), 'preserved');
    symlinkSync(sharedRoot, join(packageRoot, 'node_modules'), 'dir');
    const fakeNpm = join(fakeBin, 'npm');
    writeFileSync(fakeNpm, `#!/bin/sh
set -eu
prefix=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '--prefix' ]; then shift; prefix="$1"; fi
  shift
done
mkdir -p "$prefix/node_modules/tsx/dist"
printf 'fixture' > "$prefix/node_modules/tsx/dist/loader.mjs"
`);
    chmodSync(fakeNpm, 0o755);
    process.env.PATH = `${fakeBin}:${previousPath}`;

    const receipt = installRealDependencies(packageRoot, 'tsx/dist/loader.mjs');

    assert.equal(receipt.action, 'installed');
    assert.equal(lstatSync(join(packageRoot, 'node_modules')).isSymbolicLink(), false);
    assert.equal(readFileSync(join(packageRoot, 'node_modules', 'tsx', 'dist', 'loader.mjs'), 'utf8'), 'fixture');
    assert.equal(readFileSync(join(sharedRoot, 'preserved.txt'), 'utf8'), 'preserved');
  } finally {
    process.env.PATH = previousPath;
    rmSync(root, { recursive: true, force: true });
  }
});

test('dev initialization repairs only the reproduced generated Search ignore mutation', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-worktree-generated-ignore-'));
  const ignoreRoot = join(root, 'Search', '.decision-os');
  const ignoreFile = join(ignoreRoot, '.gitignore');
  try {
    mkdirSync(ignoreRoot, { recursive: true });
    git(root, ['init', '-b', 'dev']);
    git(root, ['config', 'user.name', 'Decision OS Test']);
    git(root, ['config', 'user.email', 'decision-os-test@localhost']);
    writeFileSync(ignoreFile, '/cache/\n/executor-analysis/\n/runs/\n');
    git(root, ['add', 'Search/.decision-os/.gitignore']);
    git(root, ['commit', '-m', 'Add fixture', '-m', 'WHAT: Add the generated-ignore fixture.\n\nWHY: Exercise exact repair admission.']);
    writeFileSync(ignoreFile, '/cache/\n/frontend-telemetry.jsonl*\n/runs/\n');

    assert.deepEqual(repairKnownGeneratedSearchIgnore(root), ['Search/.decision-os/.gitignore']);
    assert.equal(readFileSync(ignoreFile, 'utf8'), '/cache/\n/executor-analysis/\n/runs/\n');
    assert.equal(git(root, ['status', '--porcelain=v1']), '');

    writeFileSync(ignoreFile, '/cache/\n/operator-change/\n/runs/\n');
    assert.throws(
      () => repairKnownGeneratedSearchIgnore(root),
      (error: unknown) => isCliError(error, 'worktree_dev_tracked_dirty'),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
