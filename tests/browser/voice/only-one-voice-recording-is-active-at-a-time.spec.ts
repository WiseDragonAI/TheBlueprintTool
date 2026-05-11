/**
 * WHAT: Integration test for spec 3d074416: Only one voice recording is active at a time..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Only one voice recording is active at a time.', async () => {
  await assertFrontendSpec('Only one voice recording is active at a time.', '3d074416', 'voice');
});
