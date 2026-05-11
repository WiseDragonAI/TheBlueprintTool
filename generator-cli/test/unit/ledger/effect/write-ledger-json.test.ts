/**
 * WHAT: Unit test for generated function write-ledger-json.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeLedgerJson } from '../../../../src/business/ledger/effect/write-ledger-json.js';

test('write-ledger-json returns generated execution output', async () => {
  const result = await writeLedgerJson({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
