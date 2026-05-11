/**
 * WHAT: Integration test for spec ce0c5d80: Ctrl-click zone adds intersecting cards to the existing selection.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Ctrl-click zone adds intersecting cards to the existing selection', async () => {
  await assertFrontendSpec('Ctrl-click zone adds intersecting cards to the existing selection', 'ce0c5d80', 'selection');
});
