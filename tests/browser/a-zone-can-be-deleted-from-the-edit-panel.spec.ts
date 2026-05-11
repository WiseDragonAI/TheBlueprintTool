/**
 * WHAT: Integration test for spec 2000000f: a zone can be deleted from the edit panel.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('a zone can be deleted from the edit panel', async () => {
  await assertFrontendSpec('a zone can be deleted from the edit panel', '2000000f', 'zone');
});
