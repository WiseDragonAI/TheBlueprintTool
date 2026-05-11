/**
 * WHAT: Integration test for spec a946fbe0: hovering a card shows its hash id.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('hovering a card shows its hash id', async () => {
  await assertFrontendSpec('hovering a card shows its hash id', 'a946fbe0', 'card');
});
