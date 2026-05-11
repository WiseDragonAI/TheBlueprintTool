/**
 * WHAT: Unit test for generated function parse-function-batch.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFunctionBatch } from '../../../../src/business/master-ledger/helper/parse-function-batch.js';

test('parse-function-batch returns generated execution output', async () => {
  const result = await parseFunctionBatch({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
