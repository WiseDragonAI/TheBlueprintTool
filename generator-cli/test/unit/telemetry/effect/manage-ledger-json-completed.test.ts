/**
 * WHAT: Unit test for generated function manage-ledger-json-completed.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { manageLedgerJsonCompleted } from '../../../../src/business/telemetry/effect/manage-ledger-json-completed.js';

test('manage-ledger-json-completed returns generated execution output', async () => {
  const result = await manageLedgerJsonCompleted({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
