/**
 * WHAT: Integration test for spec 60000003: card positions are persisted in a JSON ledger.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('card positions are persisted in a JSON ledger', async () => {
  await assertFrontendSpec('card positions are persisted in a JSON ledger', '60000003', 'card');
});
