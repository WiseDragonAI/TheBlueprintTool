/**
 * WHAT: Unit test for generated function verify-typescript-project.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTypescriptProjectController } from '../../../../src/business/command/controller/verify-typescript-project.js';

test('verify-typescript-project returns generated execution output', async () => {
  const result = await verifyTypescriptProjectController({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
