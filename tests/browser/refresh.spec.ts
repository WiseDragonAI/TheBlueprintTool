/**
 * WHAT: Integration test for spec 50000006: refresh.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('refresh', async () => {
  await assertFrontendSpec('refresh', '50000006', 'refresh');
});
