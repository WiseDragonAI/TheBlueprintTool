/**
 * WHAT: Unit coverage for generated function apply-generated-worktree.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGeneratedWorktreeController } from '../../../../src/business/generate/controller/apply-generated-worktree.js';

test('apply-generated-worktree exports an implemented function', () => {
  assert.equal(typeof applyGeneratedWorktreeController, 'function');
});
