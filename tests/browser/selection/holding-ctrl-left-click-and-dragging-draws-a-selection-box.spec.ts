/**
 * WHAT: Integration test for spec 30000002: holding Ctrl + left-click and dragging draws a selection box.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('holding Ctrl + left-click and dragging draws a selection box', async () => {
  await assertFrontendSpec('holding Ctrl + left-click and dragging draws a selection box', '30000002', 'selection');
});
