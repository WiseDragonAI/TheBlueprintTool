/**
 * WHAT: Integration test for spec 6000000b: selecting a card highlights its directly connected cards.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('selecting a card highlights its directly connected cards', async () => {
  await assertFrontendSpec('selecting a card highlights its directly connected cards', '6000000b', 'selection');
});
