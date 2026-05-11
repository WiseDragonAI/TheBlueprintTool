/**
 * WHAT: Integration test for spec 2000000d: a zone has a notes button linked to a thread.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('a zone has a notes button linked to a thread', async () => {
  await assertFrontendSpec('a zone has a notes button linked to a thread', '2000000d', 'relationship');
});
