/**
 * WHAT: Integration test for spec 51a6af83: The active tab is derived from the browser path..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('The active tab is derived from the browser path.', async () => {
  await assertFrontendSpec('The active tab is derived from the browser path.', '51a6af83', 'navigation');
});
