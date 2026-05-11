/**
 * WHAT: Integration test for spec 50000016: copy selection.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('copy selection', async () => {
  await assertFrontendSpec('copy selection', '50000016', 'selection');
});
