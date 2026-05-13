/**
 * WHAT: Integration test for spec 6000000d: the base card class opens notes canonically.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('the base card class opens notes canonically', async () => {
  await assertFrontendSpec('the base card class opens notes canonically', '6000000d', 'card');
});
