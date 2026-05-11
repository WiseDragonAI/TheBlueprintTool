/**
 * WHAT: Integration test for spec 796827d0: Group border is thicker than a normal zone border.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Group border is thicker than a normal zone border', async () => {
  await assertFrontendSpec('Group border is thicker than a normal zone border', '796827d0', 'group');
});
