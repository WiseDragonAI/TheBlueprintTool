/**
 * WHAT: Integration test for spec 3f0c9e77: Thread terminal inherits the active target color.
 * WHY: Thread context should preserve the selected card or zone visual identity.
 */
import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Thread terminal inherits the active target color.', async () => {
  await assertFrontendSpec('Thread terminal inherits the active target color.', '3f0c9e77', 'thread');
});
