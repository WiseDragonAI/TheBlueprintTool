/**
 * WHAT: Integration test for spec bf394c62: Honeycomb background tiling scale stays screen stable during canvas zoom.
 * WHY: Zoom must not make the background pattern balloon or shrink with canvas content.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Honeycomb background tiling scale stays screen stable during canvas zoom', async () => {
  await assertFrontendSpec('Honeycomb background tiling scale stays screen stable during canvas zoom', 'bf394c62', 'canvas');
});
