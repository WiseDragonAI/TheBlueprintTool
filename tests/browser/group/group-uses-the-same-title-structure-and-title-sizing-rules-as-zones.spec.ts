/**
 * WHAT: Integration test for spec 4801e6c7: Group uses the same title structure and title sizing rules as zones.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Group uses the same title structure and title sizing rules as zones', async () => {
  await assertFrontendSpec('Group uses the same title structure and title sizing rules as zones', '4801e6c7', 'group');
});
