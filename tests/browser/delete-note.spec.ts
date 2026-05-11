/**
 * WHAT: Integration test for spec 50000015: delete note.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('delete note', async () => {
  await assertFrontendSpec('delete note', '50000015', 'thread');
});
