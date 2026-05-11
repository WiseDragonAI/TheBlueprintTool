/**
 * WHAT: Integration test for spec 20000003: zones can be named.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('zones can be named', async () => {
  await assertFrontendSpec('zones can be named', '20000003', 'zone');
});
