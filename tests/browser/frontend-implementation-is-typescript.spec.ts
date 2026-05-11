/**
 * WHAT: Integration test for spec f4b6d2a8: Frontend implementation is TypeScript.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Frontend implementation is TypeScript', async () => {
  await assertFrontendSpec('Frontend implementation is TypeScript', 'f4b6d2a8', 'canvas');
});
