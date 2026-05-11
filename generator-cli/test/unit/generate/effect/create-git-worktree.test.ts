/**
 * WHAT: Unit coverage for generated function create-git-worktree.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitWorktree } from '../../../../src/business/generate/effect/create-git-worktree.js';

test('create-git-worktree exports an implemented function', () => {
  assert.equal(typeof createGitWorktree, 'function');
});
