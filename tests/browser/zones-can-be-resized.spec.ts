/**
 * WHAT: Integration test for spec 20000006: zones can be resized.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('zones can be resized', async () => {
  await assertFrontendSpec('zones can be resized', '20000006', 'zone');
});
