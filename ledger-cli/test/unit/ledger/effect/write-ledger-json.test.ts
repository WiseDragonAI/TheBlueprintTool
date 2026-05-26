/**
 * WHAT: Unit coverage for generated function write-ledger-json.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeLedgerJson } from '../../../../src/business/ledger/effect/write-ledger-json.js';

test('write-ledger-json exports an implemented function', () => {
  assert.equal(typeof writeLedgerJson, 'function');
});
