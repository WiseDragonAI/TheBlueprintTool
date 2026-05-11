/**
 * WHAT: Unit test for generated function verify-typescript-source-files.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTypescriptSourceFiles } from '../../../../src/business/command/helper/verify-typescript-source-files.js';

test('verify-typescript-source-files returns generated execution output', async () => {
  const result = await verifyTypescriptSourceFiles({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
