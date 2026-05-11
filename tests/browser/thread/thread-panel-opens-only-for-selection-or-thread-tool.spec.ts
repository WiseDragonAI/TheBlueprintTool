/**
 * WHAT: Integration test for spec 2b67c924: Thread panel opens only for selection or thread tool.
 * WHY: Telemetry is not production-facing thread UI and the thread panel should appear only when context exists.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Thread panel opens only for selection or thread tool', async () => {
  await assertFrontendSpec('Thread panel opens only for selection or thread tool', '2b67c924', 'thread');
});
