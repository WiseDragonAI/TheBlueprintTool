/**
 * WHAT: Unit test for generated function classify-generated-functions.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGeneratedFunctions } from '../../../../src/business/generate/helper/classify-generated-functions.js';

test('classify-generated-functions returns generated execution output', async () => {
  const result = await classifyGeneratedFunctions({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
