/**
 * WHAT: Integration test for spec 7984a4f3: Notes opened from a zone target that zone thread..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Notes opened from a zone target that zone thread.', async () => {
  await assertFrontendSpec('Notes opened from a zone target that zone thread.', '7984a4f3', 'zone');
});
