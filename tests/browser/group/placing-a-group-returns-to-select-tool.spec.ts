/**
 * WHAT: Integration test for spec c271a0df: Placing a group returns to Select tool.
 * WHY: Drawing a group is a one-shot creation gesture.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Placing a group returns to Select tool', async () => {
  await assertFrontendSpec('Placing a group returns to Select tool', 'c271a0df', 'group');
});
