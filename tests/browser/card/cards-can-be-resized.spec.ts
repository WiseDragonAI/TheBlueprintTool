/**
 * WHAT: Integration test for spec 60000006: cards can be resized.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('cards can be resized', async () => {
  await assertFrontendSpec('cards can be resized', '60000006', 'card');
});
