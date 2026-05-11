/**
 * WHAT: Integration test for spec 6000000e: clicking on card notes opens the card thread in the right panel.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('clicking on card notes opens the card thread in the right panel', async () => {
  await assertFrontendSpec('clicking on card notes opens the card thread in the right panel', '6000000e', 'card');
});
