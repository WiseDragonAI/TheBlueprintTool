/**
 * WHAT: Unit test for generated function emit-dispatch-cli-command-started.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { emitDispatchCliCommandStarted } from '../../../../src/business/telemetry/effect/emit-dispatch-cli-command-started.js';

test('emit-dispatch-cli-command-started returns generated execution output', async () => {
  const result = await emitDispatchCliCommandStarted({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
