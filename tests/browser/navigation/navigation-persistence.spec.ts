/**
 * WHAT: Integration test for spec 40000012: navigation persistence.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('navigation persistence', async () => {
  await assertFrontendSpec('navigation persistence', '40000012', 'navigation');
});
