/**
 * WHAT: Integration test for spec bd0651aa: Placing a zone returns to Select tool.
 * WHY: Drawing a zone is a one-shot creation gesture.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Placing a zone returns to Select tool', async () => {
  await assertFrontendSpec('Placing a zone returns to Select tool', 'bd0651aa', 'zone');
});
