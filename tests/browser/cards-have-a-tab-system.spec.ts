/**
 * WHAT: Integration test for spec 6000000c: cards have a tab system.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('cards have a tab system', async () => {
  await assertFrontendSpec('cards have a tab system', '6000000c', 'card');
});
