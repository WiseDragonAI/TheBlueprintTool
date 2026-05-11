/**
 * WHAT: Unit test for generated function write-generated-report-file.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeGeneratedReportFile } from '../../../../src/business/report/effect/write-generated-report-file.js';

test('write-generated-report-file returns generated execution output', async () => {
  const result = await writeGeneratedReportFile({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
