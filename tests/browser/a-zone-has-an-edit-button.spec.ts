/**
 * WHAT: Integration test for spec 2000000c: a zone has an edit button.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('a zone has an edit button', async () => {
  await assertFrontendSpec('a zone has an edit button', '2000000c', 'zone');
});
