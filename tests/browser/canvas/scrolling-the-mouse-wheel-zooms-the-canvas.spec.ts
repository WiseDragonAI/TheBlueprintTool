/**
 * WHAT: Integration test for spec 30000005: scrolling the mouse wheel zooms the canvas.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('scrolling the mouse wheel zooms the canvas', async () => {
  await assertFrontendSpec('scrolling the mouse wheel zooms the canvas', '30000005', 'canvas');
});
