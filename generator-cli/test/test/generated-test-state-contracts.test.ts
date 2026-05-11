/**
 * WHAT: Spec 678cf79e test for previous and next state contracts.
 * WHY: generated tests must make state contracts explicit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTestStateContracts } from '../../src/index.js';
import { sampleFunctions } from '../fixture/scenario.js';

test('Generated tests include previous state and next state contracts', () => {
  const contracts = buildTestStateContracts(sampleFunctions());
  assert.equal(contracts[0].previousState.phase, 'before');
  assert.equal(contracts[0].nextState.phase, 'after');
});
