/**
 * WHAT: Integration test for spec ba1544b0: Arrows should try to avoid colliding with cards.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Arrows should try to avoid colliding with cards', async () => {
  await assertFrontendSpec('Arrows should try to avoid colliding with cards', 'ba1544b0', 'relationship');
});
