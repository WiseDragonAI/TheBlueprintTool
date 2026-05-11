/**
 * WHAT: Spec e1a9b6c2 test for generated integration suite assertions.
 * WHY: generated integration suites only produce telemetry facts for agent review.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorktreePlan, enumerateGeneratedFunctions } from '../../src/index.js';
import { loadBatch } from '../fixture/scenario.js';

test('generated integration suites log telemetry facts without assertions', async () => {
  const batch = await loadBatch();
  const functions = enumerateGeneratedFunctions(batch);
  const plan = createWorktreePlan({ output: '.worktrees/x', functions, suites: batch.suites });

  for (const file of plan.integrationTestFiles) {
    assert.doesNotMatch(file.content, /node:assert/);
    assert.doesNotMatch(file.content, /assert\./);
    assert.match(file.content, /actualTelemetry/);
    assert.match(file.content, /console\.log\(JSON\.stringify/);
  }
});
