/**
 * WHAT: Integration test for spec 6000000f: cards have a discussion thread.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('cards have a discussion thread', async () => {
  await assertFrontendSpec('cards have a discussion thread', '6000000f', 'card');
});
