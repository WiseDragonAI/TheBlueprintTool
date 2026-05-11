/**
 * WHAT: Spec 99fab004 test for function metadata headers.
 * WHY: functions in the master ledger must carry domain, dash-case name, comments, and pseudocode only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFunctionMetadataHeader } from '../../src/index.js';
import { parseRawBatch } from '../fixture/scenario.js';

test('Function metadata header contains domain name comments and pseudocode only', async () => {
  const batch = await parseRawBatch();
  assert.equal(validateFunctionMetadataHeader(batch).ok, true);
});
