/**
 * WHAT: Integration test for spec 5e6a9b23: Thread terminal uses black outer shadow and input-only inset frame.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Thread terminal uses black outer shadow and input-only inset frame.', async () => {
  await assertFrontendSpec('Thread terminal uses black outer shadow and input-only inset frame.', '5e6a9b23', 'thread');
});
