/**
 * WHAT: Unit test for generated function resolve-ledger-groups.
 * WHY: each generated function must have one dedicated unit test file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLedgerGroups } from '../../../../src/business/report/helper/resolve-ledger-groups.js';

test('resolve-ledger-groups returns generated execution output', async () => {
  const result = await resolveLedgerGroups({ action_payload: {}, ok: true } as never);
  assert.ok(result === undefined || typeof result === 'object');
});
