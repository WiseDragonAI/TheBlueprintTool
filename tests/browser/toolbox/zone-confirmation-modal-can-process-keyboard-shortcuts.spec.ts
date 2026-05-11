/**
 * WHAT: Integration test for spec 20000015: zone confirmation modal can process keyboard shortcuts.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('zone confirmation modal can process keyboard shortcuts', async () => {
  await assertFrontendSpec('zone confirmation modal can process keyboard shortcuts', '20000015', 'zone');
});
