/**
 * WHAT: Spec 17ecbce8 test for git worktree creation.
 * WHY: generated slices must be created under ./.worktrees as git worktrees.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitWorktree } from '../../src/index.js';
import { fakeProcess } from '../fixture/scenario.js';

test('Generated slice is created inside a git worktree under ./.worktrees', async () => {
  const result = await createGitWorktree('.worktrees/run-a', { process: fakeProcess(0) });
  assert.equal(result.ok, true);
});
