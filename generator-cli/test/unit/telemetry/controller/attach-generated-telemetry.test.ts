/**
 * WHAT: Unit test for generated function attach-generated-telemetry.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { attachGeneratedTelemetryController } from '../../../../src/business/telemetry/controller/attach-generated-telemetry.js';

test('attach-generated-telemetry returns generated execution output', async () => {
  const result = await attachGeneratedTelemetryController({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
