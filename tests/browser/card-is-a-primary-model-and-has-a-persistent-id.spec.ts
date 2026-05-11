/**
 * WHAT: Integration test for spec 60000010: Card is a primary model and has a persistent ID.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Card is a primary model and has a persistent ID', async () => {
  await assertFrontendSpec('Card is a primary model and has a persistent ID', '60000010', 'card');
});
