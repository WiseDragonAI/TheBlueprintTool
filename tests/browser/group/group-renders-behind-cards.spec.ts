/**
 * WHAT: Integration test for spec 0421d906: Group renders behind cards.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Group renders behind cards', async () => {
  await assertFrontendSpec('Group renders behind cards', '0421d906', 'group');
});
