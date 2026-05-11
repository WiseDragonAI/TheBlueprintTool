/**
 * WHAT: Integration test for spec 74567497: Dragging elements at non-default zoom uses canvas-space deltas.
 * WHY: Pointer movement is measured in screen space, but durable canvas geometry must mutate in canvas space.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Dragging elements at non-default zoom uses canvas-space deltas', async () => {
  await assertFrontendSpec('Dragging elements at non-default zoom uses canvas-space deltas', '74567497', 'canvas');
});
