/**
 * WHAT: Integration test for spec 20000012: zone deletion by pressing Del requires a confirmation modal.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('zone deletion by pressing Del requires a confirmation modal', async () => {
  await assertFrontendSpec('zone deletion by pressing Del requires a confirmation modal', '20000012', 'zone');
});
