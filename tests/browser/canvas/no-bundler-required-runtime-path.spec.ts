/**
 * WHAT: Integration test for spec aba21270: No bundler-required runtime path.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('No bundler-required runtime path', async () => {
  await assertFrontendSpec('No bundler-required runtime path', 'aba21270', 'canvas');
});
