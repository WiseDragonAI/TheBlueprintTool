/**
 * WHAT: Integration test for spec 30000004: left-clicking an unselected zone and dragging pans the canvas.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('left-clicking an unselected zone and dragging pans the canvas', async () => {
  await assertFrontendSpec('left-clicking an unselected zone and dragging pans the canvas', '30000004', 'selection');
});
