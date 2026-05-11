/**
 * WHAT: Spec 88d069d5 test for one integration test per suite.
 * WHY: each suite must prove the full generated path.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorktreePlan, enumerateGeneratedFunctions } from '../../src/index.js';
import { loadBatch } from '../fixture/scenario.js';

test('Each suite includes one integration test for the full generated path', async () => {
  const batch = await loadBatch();
  const plan = createWorktreePlan({ output: '.worktrees/x', functions: enumerateGeneratedFunctions(batch), suites: batch.suites });
  assert.equal(plan.integrationTestFiles.length, batch.suites.length);
  assert.equal(batch.suites.length, 38);
});
