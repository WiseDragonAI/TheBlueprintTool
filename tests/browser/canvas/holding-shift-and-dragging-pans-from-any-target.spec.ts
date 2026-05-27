/**
 * WHAT: Integration test for spec 9f04b1c2: holding Shift and dragging pans from any target.
 * WHY: Operators need an override that pans the canvas without selecting or moving cards, zones, or groups.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('holding Shift and dragging pans from any target', async () => {
  await assertFrontendSpec('holding Shift and dragging pans from any target', '9f04b1c2', 'canvas');
});
