/**
 * WHAT: Integration test for spec 12749dcd: The navbar renders the tab registry..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('The navbar renders the tab registry.', async () => {
  await assertFrontendSpec('The navbar renders the tab registry.', '12749dcd', 'navigation');
});
