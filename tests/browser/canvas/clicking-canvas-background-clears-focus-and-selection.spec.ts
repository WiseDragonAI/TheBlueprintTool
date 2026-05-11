/**
 * WHAT: Integration test for spec 72af9d0b: Clicking canvas background clears focus and selection.
 * WHY: Empty canvas clicks must return the operator to a neutral focus state.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Clicking canvas background clears focus and selection', async () => {
  await assertFrontendSpec('Clicking canvas background clears focus and selection', '72af9d0b', 'canvas');
});
