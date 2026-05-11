/**
 * WHAT: Integration test for spec 53d49146: Group tool is present next to Zone in the Core toolbar.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Group tool is present next to Zone in the Core toolbar', async () => {
  await assertFrontendSpec('Group tool is present next to Zone in the Core toolbar', '53d49146', 'group');
});
