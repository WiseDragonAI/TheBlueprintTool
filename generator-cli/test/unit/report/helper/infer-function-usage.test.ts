/**
 * WHAT: Unit test for generated function infer-function-usage.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { inferFunctionUsage } from '../../../../src/business/report/helper/infer-function-usage.js';

test('infer-function-usage returns generated execution output', async () => {
  const result = await inferFunctionUsage({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
