/**
 * WHAT: Integration test for spec 50000014: create note.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('create note', async () => {
  await assertFrontendSpec('create note', '50000014', 'thread');
});
