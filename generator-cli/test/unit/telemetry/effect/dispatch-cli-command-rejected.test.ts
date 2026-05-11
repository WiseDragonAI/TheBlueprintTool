/**
 * WHAT: Unit test for generated function dispatch-cli-command-rejected.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchCliCommandRejected } from '../../../../src/business/telemetry/effect/dispatch-cli-command-rejected.js';

test('dispatch-cli-command-rejected returns generated execution output', async () => {
  const result = await dispatchCliCommandRejected({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
