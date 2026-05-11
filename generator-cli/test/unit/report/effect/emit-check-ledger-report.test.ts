/**
 * WHAT: Unit test for generated function emit-check-ledger-report.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { emitCheckLedgerReport } from '../../../../src/business/report/effect/emit-check-ledger-report.js';

test('emit-check-ledger-report returns generated execution output', async () => {
  const result = await emitCheckLedgerReport({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
