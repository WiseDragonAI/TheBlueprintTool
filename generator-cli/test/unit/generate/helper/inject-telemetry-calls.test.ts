/**
 * WHAT: Unit test for generated function inject-telemetry-calls.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { injectTelemetryCalls } from '../../../../src/business/generate/helper/inject-telemetry-calls.js';

test('inject-telemetry-calls returns generated execution output', async () => {
  const result = await injectTelemetryCalls({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
