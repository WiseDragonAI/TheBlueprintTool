/**
 * WHAT: Integration test for spec 20000011: deleting a zone does not delete the intersecting cards.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('deleting a zone does not delete the intersecting cards', async () => {
  await assertFrontendSpec('deleting a zone does not delete the intersecting cards', '20000011', 'zone');
});
