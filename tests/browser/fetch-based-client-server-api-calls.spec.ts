/**
 * WHAT: Integration test for spec e4ed5372: Fetch-based client/server API calls.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Fetch-based client/server API calls', async () => {
  await assertFrontendSpec('Fetch-based client/server API calls', 'e4ed5372', 'canvas');
});
