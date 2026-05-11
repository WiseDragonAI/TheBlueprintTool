/**
 * WHAT: Integration test for spec d2fbfa28: Clicking exposed group background targets the group.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Clicking exposed group background targets the group', async () => {
  await assertFrontendSpec('Clicking exposed group background targets the group', 'd2fbfa28', 'group');
});
