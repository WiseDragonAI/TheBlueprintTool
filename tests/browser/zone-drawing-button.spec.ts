/**
 * WHAT: Integration test for spec e0b4d11a: Zone Drawing Button.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Zone Drawing Button', async () => {
  await assertFrontendSpec('Zone Drawing Button', 'e0b4d11a', 'zone');
});
