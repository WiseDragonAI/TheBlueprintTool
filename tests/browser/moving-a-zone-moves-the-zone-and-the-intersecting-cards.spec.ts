/**
 * WHAT: Integration test for spec 2000000b: moving a zone moves the zone and the intersecting cards.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('moving a zone moves the zone and the intersecting cards', async () => {
  await assertFrontendSpec('moving a zone moves the zone and the intersecting cards', '2000000b', 'zone');
});
