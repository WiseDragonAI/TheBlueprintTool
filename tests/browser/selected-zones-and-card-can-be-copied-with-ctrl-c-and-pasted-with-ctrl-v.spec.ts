/**
 * WHAT: Integration test for spec 6583c446: Selected zones and card can be copied with ctrl C and pasted with ctrl V.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Selected zones and card can be copied with ctrl C and pasted with ctrl V', async () => {
  await assertFrontendSpec('Selected zones and card can be copied with ctrl C and pasted with ctrl V', '6583c446', 'selection');
});
