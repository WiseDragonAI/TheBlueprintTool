/**
 * WHAT: Integration test for spec 20000018: Zone is a primary model and has a persistent ID.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Zone is a primary model and has a persistent ID', async () => {
  await assertFrontendSpec('Zone is a primary model and has a persistent ID', '20000018', 'zone');
});
