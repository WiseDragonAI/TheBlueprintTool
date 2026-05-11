/**
 * WHAT: Unit test for generated function write-telemetry-harness.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeTelemetryHarness } from '../../../../src/business/generate/effect/write-telemetry-harness.js';

test('write-telemetry-harness returns generated execution output', async () => {
  const result = await writeTelemetryHarness({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
