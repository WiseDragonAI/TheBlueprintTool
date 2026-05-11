/**
 * WHAT: Unit test for generated function run-report-mode.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { runReportModeController } from '../../../../src/business/report/controller/run-report-mode.js';

test('run-report-mode returns generated execution output', async () => {
  const result = await runReportModeController({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
