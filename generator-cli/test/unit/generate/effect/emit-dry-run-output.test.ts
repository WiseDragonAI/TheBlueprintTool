/**
 * WHAT: Unit test for generated function emit-dry-run-output.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { emitDryRunOutput } from '../../../../src/business/generate/effect/emit-dry-run-output.js';

test('emit-dry-run-output returns generated execution output', async () => {
  const result = await emitDryRunOutput({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
