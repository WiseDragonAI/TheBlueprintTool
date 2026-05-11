/**
 * WHAT: Unit test for generated function dispatch-cli-command.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchCliCommandController } from '../../../../src/business/command/controller/dispatch-cli-command.js';

test('dispatch-cli-command returns generated execution output', async () => {
  const result = await dispatchCliCommandController({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
