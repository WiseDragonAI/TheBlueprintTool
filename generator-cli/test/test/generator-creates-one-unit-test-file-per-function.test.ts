/**
 * WHAT: Spec d4b8e02a test for one unit test file per function.
 * WHY: each generated function must receive dedicated unit coverage.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorktreePlan, enumerateGeneratedFunctions } from '../../src/index.js';
import { loadBatch } from '../fixture/scenario.js';

test('Generator creates one unit test file per function', async () => {
  const batch = await loadBatch();
  const functions = enumerateGeneratedFunctions(batch);
  const plan = createWorktreePlan({ output: '.worktrees/x', functions, suites: batch.suites });
  assert.equal(plan.unitTestFiles.length, functions.length);
});
