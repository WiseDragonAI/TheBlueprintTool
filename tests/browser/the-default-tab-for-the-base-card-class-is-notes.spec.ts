/**
 * WHAT: Integration test for spec 6000000d: the default tab for the base card class is notes.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('the default tab for the base card class is notes', async () => {
  await assertFrontendSpec('the default tab for the base card class is notes', '6000000d', 'card');
});
