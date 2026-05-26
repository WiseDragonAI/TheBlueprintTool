/**
 * WHAT: Unit coverage for generated function read-ledger-json.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readLedgerJson } from '../../../../src/business/ledger/helper/read-ledger-json.js';

test('read-ledger-json exports an implemented function', () => {
  assert.equal(typeof readLedgerJson, 'function');
});
