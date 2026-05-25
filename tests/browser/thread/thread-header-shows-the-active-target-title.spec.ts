/**
 * WHAT: Integration test for spec f72a6d31: Thread header shows the active target title.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Thread header shows the active target title.', async () => {
  await assertFrontendSpec('Thread header shows the active target title.', 'f72a6d31', 'thread');
});
