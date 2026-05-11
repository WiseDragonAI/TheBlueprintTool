/**
 * WHAT: Spec d8e7c3a4 test for helper/effect scaffold bodies.
 * WHY: generated helper and effect files are stubs, not inferred implementations.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorktreePlan, enumerateGeneratedFunctions } from '../../src/index.js';
import { loadBatch } from '../fixture/scenario.js';

test('generated helper and effect stubs are telemetry-only', async () => {
  const batch = await loadBatch();
  const functions = enumerateGeneratedFunctions(batch);
  const plan = createWorktreePlan({ output: '.worktrees/x', functions, suites: batch.suites });
  const stubFiles = plan.sourceFiles.filter((file) => file.kind === 'helper' || file.kind === 'effect');

  assert.equal(stubFiles.length > 0, true);
  for (const file of stubFiles) {
    assert.match(file.content, /telemetry\('(helper|effect):[^']+ -> stubbed scaffold return'/);
    assert.doesNotMatch(file.content, /return\s+\{/);
    assert.doesNotMatch(file.content, /\bok:\s*true\b/);
    assert.doesNotMatch(file.content, /\bvalue:\s*/);
  }
});
