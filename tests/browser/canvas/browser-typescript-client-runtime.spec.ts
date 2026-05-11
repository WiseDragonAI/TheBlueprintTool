/**
 * WHAT: Integration test for spec c32e3e5c: Browser TypeScript client runtime.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Browser TypeScript client runtime', async () => {
  await assertFrontendSpec('Browser TypeScript client runtime', 'c32e3e5c', 'canvas');
});
