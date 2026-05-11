/**
 * WHAT: Integration test for spec a25db692: Mouse wheel zoom preserves cursor anchored canvas point.
 * WHY: Zoom must account for cursor position, not only scale around the canvas origin.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Mouse wheel zoom preserves cursor anchored canvas point', async () => {
  await assertFrontendSpec('Mouse wheel zoom preserves cursor anchored canvas point', 'a25db692', 'canvas');
});
