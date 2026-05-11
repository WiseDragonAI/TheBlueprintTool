/**
 * WHAT: Integration test for spec 60000005: persisted card positions are restored on reload.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('persisted card positions are restored on reload', async () => {
  await assertFrontendSpec('persisted card positions are restored on reload', '60000005', 'card');
});
