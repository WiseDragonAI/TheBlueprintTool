/**
 * WHAT: Integration test for spec d5c8ece7: Normal zone click replaces selection with intersecting cards.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Normal zone click replaces selection with intersecting cards', async () => {
  await assertFrontendSpec('Normal zone click replaces selection with intersecting cards', 'd5c8ece7', 'selection');
});
