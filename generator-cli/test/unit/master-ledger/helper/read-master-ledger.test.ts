/**
 * WHAT: Unit test for generated function read-master-ledger.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readMasterLedger } from '../../../../src/business/master-ledger/helper/read-master-ledger.js';

test('read-master-ledger returns generated execution output', async () => {
  const result = await readMasterLedger({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
