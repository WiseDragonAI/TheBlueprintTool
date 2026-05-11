/**
 * WHAT: Integration test for spec 86e67c0e: A zone must be selected before being draggable.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('A zone must be selected before being draggable', async () => {
  await assertFrontendSpec('A zone must be selected before being draggable', '86e67c0e', 'selection');
});
