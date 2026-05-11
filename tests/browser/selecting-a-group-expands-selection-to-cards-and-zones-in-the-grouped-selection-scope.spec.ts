/**
 * WHAT: Integration test for spec 612afeda: Selecting a group expands selection to cards and zones in the grouped selection scope.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Selecting a group expands selection to cards and zones in the grouped selection scope', async () => {
  await assertFrontendSpec('Selecting a group expands selection to cards and zones in the grouped selection scope', '612afeda', 'group');
});
