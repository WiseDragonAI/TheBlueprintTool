/**
 * WHAT: Integration test for spec 20000007: zones can be moved.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('zones can be moved', async () => {
  await assertFrontendSpec('zones can be moved', '20000007', 'zone');
});
