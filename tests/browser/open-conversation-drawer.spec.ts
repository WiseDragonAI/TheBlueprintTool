/**
 * WHAT: Integration test for spec 50000013: open conversation drawer.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('open conversation drawer', async () => {
  await assertFrontendSpec('open conversation drawer', '50000013', 'thread');
});
