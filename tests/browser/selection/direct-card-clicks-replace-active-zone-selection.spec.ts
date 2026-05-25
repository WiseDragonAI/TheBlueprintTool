/**
 * WHAT: Integration test for spec a6c2f0d4: Direct card clicks replace active zone selection.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Direct card clicks replace active zone selection.', async () => {
  await assertFrontendSpec('Direct card clicks replace active zone selection.', 'a6c2f0d4', 'selection');
});
