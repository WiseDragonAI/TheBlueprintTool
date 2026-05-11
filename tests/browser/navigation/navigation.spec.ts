/**
 * WHAT: Integration test for spec 10000002: navigation.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('navigation', async () => {
  await assertFrontendSpec('navigation', '10000002', 'navigation');
});
