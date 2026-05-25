/**
 * WHAT: Integration test for spec 2b67c924: Thread panel opens only by command.
 * WHY: Selection prepares thread context; keyboard or explicit note actions open the terminal panel.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Thread panel opens only by command.', async () => {
  await assertFrontendSpec('Thread panel opens only by command.', '2b67c924', 'thread');
});
