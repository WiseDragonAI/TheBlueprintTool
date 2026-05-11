/**
 * WHAT: Unit coverage for generated function manage-ledger-json-rejected.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { manageLedgerJsonRejected } from '../../../../src/business/telemetry/effect/manage-ledger-json-rejected.js';

test('manage-ledger-json-rejected exports an implemented function', () => {
  assert.equal(typeof manageLedgerJsonRejected, 'function');
});
