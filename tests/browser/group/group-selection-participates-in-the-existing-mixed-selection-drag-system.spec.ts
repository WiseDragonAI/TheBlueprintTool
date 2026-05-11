/**
 * WHAT: Integration test for spec d4f90f42: Group selection participates in the existing mixed-selection drag system.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Group selection participates in the existing mixed-selection drag system', async () => {
  await assertFrontendSpec('Group selection participates in the existing mixed-selection drag system', 'd4f90f42', 'group');
});
