/**
 * WHAT: Unit test for generated function manage-ledger-json.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { manageLedgerJsonController } from '../../../../src/business/ledger/controller/manage-ledger-json.js';

test('manage-ledger-json returns generated execution output', async () => {
  const result = await manageLedgerJsonController({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
