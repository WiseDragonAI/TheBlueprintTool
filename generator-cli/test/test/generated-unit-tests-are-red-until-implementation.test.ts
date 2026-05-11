/**
 * WHAT: Spec a7d3e5f1 test for generated unit test placeholders.
 * WHY: generated unit tests must stay red until a human or agent implements the scaffold.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorktreePlan, enumerateGeneratedFunctions } from '../../src/index.js';
import { loadBatch } from '../fixture/scenario.js';

test('generated unit tests are intentionally red placeholders', async () => {
  const batch = await loadBatch();
  const functions = enumerateGeneratedFunctions(batch);
  const plan = createWorktreePlan({ output: '.worktrees/x', functions, suites: batch.suites });

  assert.equal(plan.unitTestFiles.length, functions.length);
  for (const file of plan.unitTestFiles) {
    assert.match(file.content, /assert\.equal\(true, false/);
    assert.match(file.content, /requires implementation before validation/);
  }
});
