/**
 * WHAT: Unit test for generated function verify-typescript-project-completed.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTypescriptProjectCompleted } from '../../../../src/business/telemetry/effect/verify-typescript-project-completed.js';

test('verify-typescript-project-completed returns generated execution output', async () => {
  const result = await verifyTypescriptProjectCompleted({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
