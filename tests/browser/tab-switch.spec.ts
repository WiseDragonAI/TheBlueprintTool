/**
 * WHAT: Integration test for spec 50000002: tab switch.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('tab switch', async () => {
  await assertFrontendSpec('tab switch', '50000002', 'navigation');
});
