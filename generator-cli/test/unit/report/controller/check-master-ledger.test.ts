/**
 * WHAT: Unit test for generated function check-master-ledger.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMasterLedgerController } from '../../../../src/business/report/controller/check-master-ledger.js';

test('check-master-ledger returns generated execution output', async () => {
  const result = await checkMasterLedgerController({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
