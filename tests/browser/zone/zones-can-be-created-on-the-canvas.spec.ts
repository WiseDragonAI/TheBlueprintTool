/**
 * WHAT: Integration test for spec 20000002: zones can be created on the canvas.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('zones can be created on the canvas', async () => {
  await assertFrontendSpec('zones can be created on the canvas', '20000002', 'zone');
});
