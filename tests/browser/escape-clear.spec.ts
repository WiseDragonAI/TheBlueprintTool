/**
 * WHAT: Integration test for spec 5000000c: escape clear.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('escape clear', async () => {
  await assertFrontendSpec('escape clear', '5000000c', 'selection');
});
