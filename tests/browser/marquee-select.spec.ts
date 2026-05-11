/**
 * WHAT: Integration test for spec 5000000b: marquee select.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('marquee select', async () => {
  await assertFrontendSpec('marquee select', '5000000b', 'selection');
});
