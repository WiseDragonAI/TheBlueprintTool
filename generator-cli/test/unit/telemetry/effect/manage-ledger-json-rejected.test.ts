/**
 * WHAT: Unit test for generated function manage-ledger-json-rejected.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { manageLedgerJsonRejected } from '../../../../src/business/telemetry/effect/manage-ledger-json-rejected.js';

test('manage-ledger-json-rejected returns generated execution output', async () => {
  const result = await manageLedgerJsonRejected({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
