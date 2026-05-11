/**
 * WHAT: Integration test for spec 20000013: a selected zone has its border rendered in white glow and the resize icon at corners.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('a selected zone has its border rendered in white glow and the resize icon at corners', async () => {
  await assertFrontendSpec('a selected zone has its border rendered in white glow and the resize icon at corners', '20000013', 'selection');
});
