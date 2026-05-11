/**
 * WHAT: Integration test for spec b200b57e: Arrow labels can be hidden per arrow with their own display state.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Arrow labels can be hidden per arrow with their own display state', async () => {
  await assertFrontendSpec('Arrow labels can be hidden per arrow with their own display state', 'b200b57e', 'relationship');
});
