/**
 * WHAT: Integration test for spec 20000009: zones are rendered behind the cards.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('zones are rendered behind the cards', async () => {
  await assertFrontendSpec('zones are rendered behind the cards', '20000009', 'zone');
});
