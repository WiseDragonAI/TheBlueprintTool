/**
 * WHAT: Integration test for spec 85c81d67: Group renders behind regular zones.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Group renders behind regular zones', async () => {
  await assertFrontendSpec('Group renders behind regular zones', '85c81d67', 'group');
});
