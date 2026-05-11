/**
 * WHAT: Integration test for spec 30000007: the canvas has a dark honeycomb background.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('the canvas has a dark honeycomb background', async () => {
  await assertFrontendSpec('the canvas has a dark honeycomb background', '30000007', 'canvas');
});
