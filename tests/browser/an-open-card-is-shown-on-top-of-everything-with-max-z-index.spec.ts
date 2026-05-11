/**
 * WHAT: Integration test for spec 6000000a: an open card is shown on top of everything with max z-index.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('an open card is shown on top of everything with max z-index', async () => {
  await assertFrontendSpec('an open card is shown on top of everything with max z-index', '6000000a', 'card');
});
