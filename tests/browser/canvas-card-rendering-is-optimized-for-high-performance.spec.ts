/**
 * WHAT: Integration test for spec 30000008: canvas card rendering is optimized for high performance.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('canvas card rendering is optimized for high performance', async () => {
  await assertFrontendSpec('canvas card rendering is optimized for high performance', '30000008', 'card');
});
