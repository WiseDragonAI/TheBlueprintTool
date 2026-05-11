/**
 * WHAT: Integration test for spec 20000017: zone position and geometry is persisted.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('zone position and geometry is persisted', async () => {
  await assertFrontendSpec('zone position and geometry is persisted', '20000017', 'zone');
});
