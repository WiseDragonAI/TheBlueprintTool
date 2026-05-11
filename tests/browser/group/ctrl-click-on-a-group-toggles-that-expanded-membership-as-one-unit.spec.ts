/**
 * WHAT: Integration test for spec 8a05ef46: Ctrl+click on a group toggles that expanded membership as one unit.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Ctrl+click on a group toggles that expanded membership as one unit', async () => {
  await assertFrontendSpec('Ctrl+click on a group toggles that expanded membership as one unit', '8a05ef46', 'group');
});
