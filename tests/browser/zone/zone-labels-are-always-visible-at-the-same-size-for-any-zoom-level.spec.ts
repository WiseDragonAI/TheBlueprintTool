/**
 * WHAT: Integration test for spec 2000000e: zone labels are always visible at the same size for any zoom level.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('zone labels are always visible at the same size for any zoom level', async () => {
  await assertFrontendSpec('zone labels are always visible at the same size for any zoom level', '2000000e', 'zone');
});
