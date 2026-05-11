/**
 * WHAT: Integration test for spec 20000010: a zone can be deleted by pressing Del while selected.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('a zone can be deleted by pressing Del while selected', async () => {
  await assertFrontendSpec('a zone can be deleted by pressing Del while selected', '20000010', 'selection');
});
