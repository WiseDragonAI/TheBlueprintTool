/**
 * WHAT: Integration test for spec 60000009: cards from the base card class can be extended for sub-modules.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('cards from the base card class can be extended for sub-modules', async () => {
  await assertFrontendSpec('cards from the base card class can be extended for sub-modules', '60000009', 'card');
});
