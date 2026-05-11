/**
 * WHAT: Integration test for spec 3f9dda8e: Frameworkless browser client runtime.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Frameworkless browser client runtime', async () => {
  await assertFrontendSpec('Frameworkless browser client runtime', '3f9dda8e', 'canvas');
});
