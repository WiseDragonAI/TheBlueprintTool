/**
 * WHAT: Spec f2a91c7d test for one source file per generated function.
 * WHY: generated function output must be deterministic and one-to-one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorktreePlan, enumerateGeneratedFunctions } from '../../src/index.js';
import { loadBatch } from '../fixture/scenario.js';

test('Generator creates one source file per function', async () => {
  const batch = await loadBatch();
  const functions = enumerateGeneratedFunctions(batch);
  const plan = createWorktreePlan({ output: '.worktrees/x', functions, suites: batch.suites });
  assert.equal(plan.sourceFiles.length, functions.length);
});
