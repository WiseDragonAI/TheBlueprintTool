/**
 * WHAT: Integration test for spec 60000001: a selected card has a white glowy border.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('a selected card has a white glowy border', async () => {
  await assertFrontendSpec('a selected card has a white glowy border', '60000001', 'selection');
});
