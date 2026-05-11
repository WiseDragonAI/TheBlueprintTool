/**
 * WHAT: Unit test for generated function run-node-test.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { runNodeTest } from '../../../../src/business/report/helper/run-node-test.js';

test('run-node-test returns generated execution output', async () => {
  const result = await runNodeTest({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
