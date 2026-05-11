/**
 * WHAT: Integration test for spec bf394c62: Honeycomb background tiling scales with canvas zoom.
 * WHY: The honeycomb is canvas-world material and must share the transformed content layer.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Honeycomb background tiling scales with canvas zoom', async () => {
  await assertFrontendSpec('Honeycomb background tiling scales with canvas zoom', 'bf394c62', 'canvas');
});
