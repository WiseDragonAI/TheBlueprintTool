/**
 * WHAT: Spec 65bf9ae6 test for MasterLedger pseudocode contract.
 * WHY: controller pseudocode must contain telemetry, branching, parameter usage, state usage, and comments.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMasterLedgerPseudocode } from '../../src/index.js';
import { parseRawBatch } from '../fixture/scenario.js';

test('Master ledger pseudocode is syntactically correct and contains telemetry branching parameter usage state usage and comments', async () => {
  const batch = await parseRawBatch();
  assert.equal(validateMasterLedgerPseudocode(batch).ok, true);
});
