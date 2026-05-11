/**
 * WHAT: Integration test for spec f18da923: Groups can be resized with resize handles.
 * WHY: Groups are first-class canvas objects and need the same geometry editing affordance as zones.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Groups can be resized with resize handles', async () => {
  await assertFrontendSpec('Groups can be resized with resize handles', 'f18da923', 'group');
});
