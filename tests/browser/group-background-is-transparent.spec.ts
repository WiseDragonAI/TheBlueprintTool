/**
 * WHAT: Integration test for spec 1d444573: Group background is transparent.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Group background is transparent', async () => {
  await assertFrontendSpec('Group background is transparent', '1d444573', 'group');
});
