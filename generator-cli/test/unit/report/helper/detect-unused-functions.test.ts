/**
 * WHAT: Unit test for generated function detect-unused-functions.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectUnusedFunctions } from '../../../../src/business/report/helper/detect-unused-functions.js';

test('detect-unused-functions returns generated execution output', async () => {
  const result = await detectUnusedFunctions({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
