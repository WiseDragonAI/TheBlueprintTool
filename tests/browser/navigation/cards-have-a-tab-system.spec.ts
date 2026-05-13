/**
 * WHAT: Integration test for spec 6000000c: cards expose a notes action.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('cards expose a notes action', async () => {
  await assertFrontendSpec('cards expose a notes action', '6000000c', 'card');
});
