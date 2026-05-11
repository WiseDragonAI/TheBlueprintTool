/**
 * WHAT: Integration test for spec 40000006: selection clear.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('selection clear', async () => {
  await assertFrontendSpec('selection clear', '40000006', 'selection');
});
