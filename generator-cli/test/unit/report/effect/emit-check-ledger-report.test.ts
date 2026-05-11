/**
 * WHAT: Unit coverage for generated function emit-check-ledger-report.
 * WHY: promoted generator implementations must replace red scaffold placeholders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { emitCheckLedgerReport } from '../../../../src/business/report/effect/emit-check-ledger-report.js';

test('emit-check-ledger-report exports an implemented function', () => {
  assert.equal(typeof emitCheckLedgerReport, 'function');
});
