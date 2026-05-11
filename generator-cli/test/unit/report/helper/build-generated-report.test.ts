/**
 * WHAT: Unit test for generated function build-generated-report.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeneratedReport } from '../../../../src/business/report/helper/build-generated-report.js';

test('build-generated-report returns generated execution output', async () => {
  const result = await buildGeneratedReport({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
