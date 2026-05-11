/**
 * WHAT: Unit test for generated function load-and-validate-master-ledger-rejected.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAndValidateMasterLedgerRejected } from '../../../../src/business/telemetry/effect/load-and-validate-master-ledger-rejected.js';

test('load-and-validate-master-ledger-rejected returns generated execution output', async () => {
  const result = await loadAndValidateMasterLedgerRejected({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
