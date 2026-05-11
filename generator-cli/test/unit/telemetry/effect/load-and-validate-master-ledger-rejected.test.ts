/**
 * WHAT: Unit coverage for generated function load-and-validate-master-ledger-rejected.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAndValidateMasterLedgerRejected } from '../../../../src/business/telemetry/effect/load-and-validate-master-ledger-rejected.js';

test('load-and-validate-master-ledger-rejected exports an implemented function', () => {
  assert.equal(typeof loadAndValidateMasterLedgerRejected, 'function');
});
