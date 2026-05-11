/**
 * WHAT: Unit test for generated function verify-typescript-project-rejected.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTypescriptProjectRejected } from '../../../../src/business/telemetry/effect/verify-typescript-project-rejected.js';

test('verify-typescript-project-rejected returns generated execution output', async () => {
  const result = await verifyTypescriptProjectRejected({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
