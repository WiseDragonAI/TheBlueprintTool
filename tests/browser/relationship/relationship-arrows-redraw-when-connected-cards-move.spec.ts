/**
 * WHAT: Integration test for spec 1d6f456a: Relationship arrows redraw when connected cards move.
 * WHY: Relationship rendering must be coupled to current card geometry, not static boot-time SVG paths.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Relationship arrows redraw when connected cards move', async () => {
  await assertFrontendSpec('Relationship arrows redraw when connected cards move', '1d6f456a', 'relationship');
});
