/**
 * WHAT: Integration test for spec 40000005: mixed selection.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('mixed selection', async () => {
  await assertFrontendSpec('mixed selection', '40000005', 'selection');
});
