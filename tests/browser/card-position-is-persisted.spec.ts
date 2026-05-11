/**
 * WHAT: Integration test for spec 60000004: card position is persisted.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('card position is persisted', async () => {
  await assertFrontendSpec('card position is persisted', '60000004', 'card');
});
