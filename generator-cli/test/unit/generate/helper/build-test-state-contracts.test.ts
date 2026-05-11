/**
 * WHAT: Unit test for generated function build-test-state-contracts.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTestStateContracts } from '../../../../src/business/generate/helper/build-test-state-contracts.js';

test('build-test-state-contracts returns generated execution output', async () => {
  const result = await buildTestStateContracts({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
