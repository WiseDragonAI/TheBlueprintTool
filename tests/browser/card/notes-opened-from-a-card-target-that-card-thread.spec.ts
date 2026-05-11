/**
 * WHAT: Integration test for spec cc7ed3b4: Notes opened from a card target that card thread..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Notes opened from a card target that card thread.', async () => {
  await assertFrontendSpec('Notes opened from a card target that card thread.', 'cc7ed3b4', 'card');
});
