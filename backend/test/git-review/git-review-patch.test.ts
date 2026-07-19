import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyGitReviewPatch, readGitReview, resolveGitReviewRepository } from '../../src/business/git-review/helper/git-review-patch.js';

function repository() {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'decision-os-git-review-'));
  const root = join(workspaceRoot, 'packages', 'app');
  mkdirSync(root, { recursive: true });
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test']);
  writeFileSync(join(root, 'file.ts'), 'one\ntwo\nthree\n');
  execFileSync('git', ['-C', root, 'add', 'file.ts']);
  execFileSync('git', ['-C', root, 'commit', '-qm', 'base']);
  writeFileSync(join(root, 'file.ts'), 'one\nchanged\nthree\n');
  return { workspaceRoot, root };
}

test('reads a configurable nested repository and splits its hunks', () => {
  const fixture = repository();
  const review = readGitReview({ workspaceRoot: fixture.workspaceRoot, repository: 'packages/app', target: 'file.ts' });
  assert.equal(review.repository, 'packages/app');
  assert.equal(review.target, 'file.ts');
  assert.equal(review.files[0]?.path, 'file.ts');
  assert.equal(review.files[0]?.hunks.length, 1);
});

test('stages a hash-validated hunk and rejects workspace escapes', () => {
  const fixture = repository();
  const review = readGitReview({ workspaceRoot: fixture.workspaceRoot, repository: 'packages/app', target: '.' });
  const updated = applyGitReviewPatch({ workspaceRoot: fixture.workspaceRoot, repository: 'packages/app', target: '.', expectedPatchHash: review.patchHash, patch: review.files[0].hunks[0].patch, operation: 'stage' });
  assert.equal(updated.stagedFiles.length, 1);
  assert.throws(() => resolveGitReviewRepository(fixture.workspaceRoot, '../outside'), /inside the project workspace/);
});
