/**
 * WHAT: Integration test for spec 47237c02: Relationship labels render near arrow ports and preserve relationship source context.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Relationship labels render near arrow ports and preserve relationship source context', async () => {
  await assertFrontendSpec('Relationship labels render near arrow ports and preserve relationship source context', '47237c02', 'relationship');
});
