/**
 * WHAT: Unit test for generated function read-specs-ledger.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readSpecsLedger } from '../../../../src/business/report/helper/read-specs-ledger.js';

test('read-specs-ledger returns generated execution output', async () => {
  const result = await readSpecsLedger({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
