/**
 * WHAT: Spec c5329a69 test for generated default telemetry.
 * WHY: generated files must record function name, arguments, and execution phase.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorktreePlan } from '../../src/index.js';
import { injectTelemetryCalls } from '../../src/business/telemetry/helper/inject-telemetry-calls.js';
import { sampleFunctions } from '../fixture/scenario.js';

test('Generated files include default telemetry for function name and arguments', () => {
  const plan = createWorktreePlan({ output: '.worktrees/x', functions: sampleFunctions(), suites: [] });
  assert.equal(injectTelemetryCalls(plan.sourceFiles).ok, true);
});
