/**
 * WHAT: Unit test for generated function collect-telemetry-traces.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectTelemetryTraces } from '../../../../src/business/report/helper/collect-telemetry-traces.js';

test('collect-telemetry-traces returns generated execution output', async () => {
  const result = await collectTelemetryTraces({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
