/**
 * WHAT: Integration test for spec d0936729: hash id is displayed top right in a smaller font grey.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('hash id is displayed top right in a smaller font grey', async () => {
  await assertFrontendSpec('hash id is displayed top right in a smaller font grey', 'd0936729', 'card');
});
