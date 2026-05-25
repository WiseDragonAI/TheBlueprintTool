/**
 * WHAT: Integration test for spec e3a71d5c: Right thread terminal is animated and one third width.
 * WHY: The notes terminal is command-opened and should feel like a side terminal, not a small inspector.
 */
import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Right thread terminal is animated and one third width.', async () => {
  await assertFrontendSpec('Right thread terminal is animated and one third width.', 'e3a71d5c', 'thread');
});
