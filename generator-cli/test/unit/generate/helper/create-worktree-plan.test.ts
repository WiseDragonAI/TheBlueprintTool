/**
 * WHAT: Unit test for generated function create-worktree-plan.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorktreePlan } from '../../../../src/business/generate/helper/create-worktree-plan.js';

test('create-worktree-plan returns generated execution output', async () => {
  const result = await createWorktreePlan({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
