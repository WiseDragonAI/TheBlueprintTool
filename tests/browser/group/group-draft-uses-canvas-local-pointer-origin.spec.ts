/**
 * WHAT: Integration test for spec b7c2e91f: Group draft geometry uses the canvas-local pointer origin.
 * WHY: Group placement must not inherit shell offsets after mouseup.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Group draft geometry uses the canvas-local pointer origin.', async () => {
  await assertFrontendSpec('Group draft geometry uses the canvas-local pointer origin.', 'b7c2e91f', 'group');
});
