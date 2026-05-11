/**
 * WHAT: Integration test for spec 2000000a: selecting a zone selects all the cards intersecting with the zone.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('selecting a zone selects all the cards intersecting with the zone', async () => {
  await assertFrontendSpec('selecting a zone selects all the cards intersecting with the zone', '2000000a', 'selection');
});
