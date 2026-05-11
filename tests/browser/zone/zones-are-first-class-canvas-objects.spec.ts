/**
 * WHAT: Integration test for spec 20000001: zones are first-class canvas objects.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('zones are first-class canvas objects', async () => {
  await assertFrontendSpec('zones are first-class canvas objects', '20000001', 'zone');
});
