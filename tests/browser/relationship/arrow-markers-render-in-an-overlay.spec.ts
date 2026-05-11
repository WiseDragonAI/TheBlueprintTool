/**
 * WHAT: Integration test for spec 81557a54: Arrow markers render in an overlay.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Arrow markers render in an overlay', async () => {
  await assertFrontendSpec('Arrow markers render in an overlay', '81557a54', 'relationship');
});
