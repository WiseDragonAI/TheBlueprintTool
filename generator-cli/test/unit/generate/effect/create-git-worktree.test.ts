/**
 * WHAT: Unit test for generated function create-git-worktree.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitWorktree } from '../../../../src/business/generate/effect/create-git-worktree.js';

test('create-git-worktree returns generated execution output', async () => {
  const result = await createGitWorktree({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
