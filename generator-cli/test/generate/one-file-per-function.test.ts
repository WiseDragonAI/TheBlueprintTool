/**
 * WHAT: Spec 51395472 test for exactly one generated function in each source file.
 * WHY: generated source files must not combine multiple generated functions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorktreePlan, enumerateGeneratedFunctions } from '../../src/index.js';
import { loadBatch } from '../fixture/scenario.js';

test('Every generated source file contains exactly one generated function', async () => {
  const batch = await loadBatch();
  const plan = createWorktreePlan({ output: '.worktrees/x', functions: enumerateGeneratedFunctions(batch), suites: batch.suites });
  assert.ok(plan.sourceFiles.every((file) => (file.content.match(/export (?:async )?function/g) ?? []).length === 1));
});
