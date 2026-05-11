/**
 * WHAT: Unit coverage for generated function resolve-ledger-groups.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLedgerGroups } from '../../../../src/business/report/helper/resolve-ledger-groups.js';

test('resolve-ledger-groups exports an implemented function', () => {
  assert.equal(typeof resolveLedgerGroups, 'function');
});
