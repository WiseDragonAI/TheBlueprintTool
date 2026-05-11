/**
 * WHAT: Integration test for spec ac137fe2: Tabs are route-addressable..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Tabs are route-addressable.', async () => {
  await assertFrontendSpec('Tabs are route-addressable.', 'ac137fe2', 'navigation');
});
