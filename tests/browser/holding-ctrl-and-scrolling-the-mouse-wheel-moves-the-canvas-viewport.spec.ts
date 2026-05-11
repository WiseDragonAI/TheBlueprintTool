/**
 * WHAT: Integration test for spec 30000006: holding Ctrl and scrolling the mouse wheel moves the canvas viewport.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('holding Ctrl and scrolling the mouse wheel moves the canvas viewport', async () => {
  await assertFrontendSpec('holding Ctrl and scrolling the mouse wheel moves the canvas viewport', '30000006', 'canvas');
});
