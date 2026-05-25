/**
 * WHAT: Integration test for spec d8d1f4a2: Thread notes are composed in the terminal input dock.
 * WHY: Note writing should happen through the terminal composer instead of detached note buttons.
 */
import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Thread notes are composed in the terminal input dock.', async () => {
  await assertFrontendSpec('Thread notes are composed in the terminal input dock.', 'd8d1f4a2', 'thread');
});
