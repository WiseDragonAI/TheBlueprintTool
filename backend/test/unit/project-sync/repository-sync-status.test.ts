import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalGitOrigin, isNetworkGitOrigin, originFingerprint, readRepositorySyncStatus } from '../../../src/business/project-sync/helper/repository-sync-status.js';

function git(root: string, ...args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

test('reads the complete fixed Git snapshot without leaking worktree paths', () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-project-sync-status-'));
  const remote = join(home, 'origin.git');
  const checkout = join(home, 'checkout');
  try {
    execFileSync('git', ['init', '--bare', remote]);
    execFileSync('git', ['clone', remote, checkout]);
    git(checkout, 'config', 'user.name', 'Decision OS Test');
    git(checkout, 'config', 'user.email', 'test@decision-os.invalid');
    mkdirSync(join(checkout, '.decision-os'));
    writeFileSync(join(checkout, '.decision-os', 'state.json'), '{"ledgers":[]}\n');
    git(checkout, 'add', '.decision-os/state.json');
    git(checkout, 'commit', '-m', 'initialize project');
    git(checkout, 'push', '-u', 'origin', 'HEAD');
    const status = readRepositorySyncStatus(checkout);
    assert.equal(status.porcelain, '');
    assert.equal(status.headSha, status.originSha);
    assert.equal(status.worktrees.length, 1);
    assert.deepEqual(status.worktrees[0], { branch: status.branch, headSha: status.headSha, porcelain: '', clean: true });
    assert.equal(status.originFingerprint, originFingerprint(status.originUrl));
    assert.equal(JSON.stringify(status).includes(checkout), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('canonical origin fingerprints ignore credentials, transport, and .git suffixes', () => {
  assert.equal(canonicalGitOrigin('https://user:secret@Example.com/team/repo.git'), 'example.com/team/repo');
  assert.equal(originFingerprint('https://user:secret@Example.com/team/repo.git'), originFingerprint('https://example.com/team/repo'));
  assert.equal(originFingerprint('git@Example.com:team/repo.git'), originFingerprint('https://example.com/team/repo'));
  assert.equal(originFingerprint('ssh://git@example.com/team/repo.git'), originFingerprint('https://example.com/team/repo'));
  assert.equal(isNetworkGitOrigin('git@example.com:team/repo.git'), true);
  assert.equal(isNetworkGitOrigin('/srv/private/repo.git'), false);
});
