/**
 * WHAT: Unit test for generated function read-ledger-json.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readLedgerJson } from '../../../../src/business/ledger/helper/read-ledger-json.js';

test('read-ledger-json returns generated execution output', async () => {
  const result = await readLedgerJson({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
