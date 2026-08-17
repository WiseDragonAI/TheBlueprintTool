/**
 * WHAT: Verifies that the production pull-restart command preserves and rejects parent checkout dirt.
 * WHY: A production update must not stash, overwrite, pull across, or restart with direct main-checkout edits.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const sourceCommand = resolve(import.meta.dirname, '../../../bin/decision-os-pull-restart.mjs');

function git(cwd: string, args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

test('rejects parent checkout dirt without stashing, pulling, or restarting', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'decision-os-pull-restart-'));
  const repositoryRoot = join(fixtureRoot, 'repository');
  const remoteRoot = join(fixtureRoot, 'remote.git');
  const fakeBin = join(fixtureRoot, 'bin');
  const restartMarker = join(fixtureRoot, 'sv-called');
  try {
    mkdirSync(join(repositoryRoot, 'bin'), { recursive: true });
    mkdirSync(fakeBin, { recursive: true });
    copyFileSync(sourceCommand, join(repositoryRoot, 'bin/decision-os-pull-restart.mjs'));
    writeFileSync(join(fakeBin, 'sv'), `#!/bin/sh\nprintf '%s\\n' "$*" > ${JSON.stringify(restartMarker)}\n`);
    chmodSync(join(fakeBin, 'sv'), 0o755);

    git(fixtureRoot, ['init', '--bare', remoteRoot]);
    git(repositoryRoot, ['init', '--initial-branch=main']);
    git(repositoryRoot, ['config', 'user.name', 'Decision OS Test']);
    git(repositoryRoot, ['config', 'user.email', 'decision-os-test@example.invalid']);
    git(repositoryRoot, ['add', 'bin/decision-os-pull-restart.mjs']);
    git(repositoryRoot, ['commit', '-m', 'Fixture baseline']);
    git(repositoryRoot, ['remote', 'add', 'origin', remoteRoot]);
    git(repositoryRoot, ['push', '--set-upstream', 'origin', 'main']);
    writeFileSync(join(repositoryRoot, 'operator-change.txt'), 'preserve me\n');

    const result = spawnSync(process.execPath, ['bin/decision-os-pull-restart.mjs'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
        DECISION_OS_HEALTH_TIMEOUT_MS: '50',
      },
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing to pull or restart because the main checkout has local changes/);
    assert.match(result.stderr, /operator-change\.txt/);
    assert.equal(readFileSync(join(repositoryRoot, 'operator-change.txt'), 'utf8'), 'preserve me\n');
    assert.equal(spawnSync('git', ['stash', 'list'], { cwd: repositoryRoot, encoding: 'utf8' }).stdout, '');
    assert.throws(() => readFileSync(restartMarker, 'utf8'), { code: 'ENOENT' });
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
