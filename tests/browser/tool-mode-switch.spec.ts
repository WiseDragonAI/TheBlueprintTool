/**
 * WHAT: Integration test for spec 40000007: tool mode switch.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('tool mode switch', async () => {
  await assertFrontendSpec('tool mode switch', '40000007', 'toolbox');
});
