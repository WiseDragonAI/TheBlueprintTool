/**
 * WHAT: Integration test for spec 20000004: zones have a color.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('zones have a color', async () => {
  await assertFrontendSpec('zones have a color', '20000004', 'zone');
});
