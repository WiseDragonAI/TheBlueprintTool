/**
 * WHAT: Integration test for spec 60000002: a card is drag-and-drop enabled.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('a card is drag-and-drop enabled', async () => {
  await assertFrontendSpec('a card is drag-and-drop enabled', '60000002', 'card');
});
