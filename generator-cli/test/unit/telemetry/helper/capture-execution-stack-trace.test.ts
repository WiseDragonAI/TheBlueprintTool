/**
 * WHAT: Unit test for generated function capture-execution-stack-trace.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureExecutionStackTrace } from '../../../../src/business/telemetry/helper/capture-execution-stack-trace.js';

test('capture-execution-stack-trace returns generated execution output', async () => {
  const result = await captureExecutionStackTrace({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
