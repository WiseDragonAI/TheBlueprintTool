/**
 * WHAT: Integration test for spec d9d57c2c: Clicking a card inside a group targets the card.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Clicking a card inside a group targets the card', async () => {
  await assertFrontendSpec('Clicking a card inside a group targets the card', 'd9d57c2c', 'group');
});
